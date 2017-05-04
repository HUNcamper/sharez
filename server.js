// Copyright 2017 Selim Nahimi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// ** ShareZ server, written by HUNcamper
// ** A server for storing files



//// ** Setup
// Dependencies
const express		=	require('express');			// npm install express
const ejs			=	require('ejs');				// npm install ejs
const cookies		=	require('cookies');			// npm install cookies
const mysql			=	require('mysql');			// npm install mysql
const dicer			=	require('dicer');			// npm install dicer
const fs			=	require('fs');				
const path			=	require('path');			
const http			=	require('http');			
const crypto		=	require('crypto');			
var AWS = require('aws-sdk');
// Config Load
const config		=	require('./config.json');	// config file

// Regexes
// Content-Disposition filename regex: "filename=xxx"
const ContentDispositionFilenameRegex	=	/filename=(?:"([^"]+)"|([^;]+))/;
// Content-Disposition name regex: "name=xxx"
const ContentDispositionNameRegex		=	/[^e]name=(?:"([^"]+)"|([^;]+))/;
// Filename regex
const FilenameRegex						=	/^(?:^.*)?\.([a-z0-9_-]+)$/i;
// Multipart Content-Type regex: "multipart/formdata; boundary=xxx"
const MultipartRegex					=	/^multipart\/form-data; boundary=(?:"([^"]+)"|([^;]+))$/;

// Express App
var app = express();

// MySQL
var connection;
var db_config = {
	host     : config['database'].host,
	user     : config['database'].user,
	password : config['database'].pass,
	database : config['database'].db
};

// In case the MySQL connection halts, restart it
function handleDBDisconnect() {
	connection = mysql.createConnection(db_config);
	connection.connect(err => {
		if(err) {
			console.log('MySQL connection failed: ', err);
			setTimeout(handleDBDisconnect, 2000);
		}
	});
	
	connection.on('error', err => {
		console.log('MySQL error: ', err);
		if(err.code === 'PROTOCOL_CONNECTION_LOST')  {
			handleDBDisconnect();
		} else {
			throw err;
		}
	});
}

handleDBDisconnect();


// Public folder for Express
app.use(express.static(__dirname + '/public/uploads'));


//// ** Express App listener
// Main Page
app.get('/', function(req, res){
	fs.readFile('public/page/index.html', 'utf-8', function(err, content) {
		if (err) { console.log(err); return res.status(500).send('Internal Server Error'); }
		
		var size = 0, amount = 0;
		fs.readdir('public/uploads/', function(err, files) {
			if(err) console.error('Error occurred while counting files');
			files.forEach(file => {
				let stats = fs.statSync('public/uploads/'+file);
				size += stats.size;
				amount++;
			});
			
			size = (size / 1024 / 1024).toFixed(2);
			var renderedHtml = ejs.render(content, {amount: amount, size: size});  //get redered HTML code
			res.send(renderedHtml);
		});
		
		
	});
});

// Upload
app.all('/upload', function(req, res){
	// Redirect to main page if not POST
	if(req.method === 'GET') {
		res.writeHead(302, {'Location': '/'});
		return res.end();
	}
	
	let files = [];
	let api = '';
	
	// Check authorization (via an 'api' header or a ?api= query string)
	if(req.headers['api'] != config.api) {
		if(req.query.api != config.api) {
			res.status(401).send('Unauthorized').end();
			return req.destroy();
		} else api = req.query.api;
	} else api = req.headers['api'];
	
	// Check the content-length header, and reject if too big
	if(req.headers['content-length'] && parseInt(req.headers['content-length']) > (config.maxFileSize * config.maxFilesPerUpload)) {
		res.status(413).send('Payload too large').end();
		return req.destroy();
	}
	
	// Check the content-type header
	let contentType = MultipartRegex.exec(req.headers['content-type']);
	if (contentType === null) {
		return res.status(400).send('invalid Content-Type header');
	}
	
	// Parse incoming data using Dicer
	let d = new dicer({
		boundary: contentType[1] || contentType[2],
		maxHeaderPairs: 50
	});
	d.on('part', p => {
		let file = {
			data: [],
			ext: null,
			filename: null,
			mime: null
		};
		p.on('header', head => {
			for (let h in head) {
				if (h === 'content-disposition') {
					let name = ContentDispositionNameRegex.exec(head[h][0]);
					if (name === null || name[1] !== 'files[]') {
						return res.status(400).send('file field name should be files[], instead its ' + JSON.stringify(name));
						req.destroy();
					}
					let filename = ContentDispositionFilenameRegex.exec(head[h][0]);
					if (filename !== null) {
						file.filename = filename[1];
						let ext = FilenameRegex.exec(filename[1]);
						if (ext !== null) file.ext = ext[1].toLowerCase();
					}
				}
				if (h === 'content-type') file.mime = head[h][0];
			}
		});
		p.on('data', data => {
			file.data.push(data);
		});
		p.on('end', () => {
			if (files.length >= config.maxFilesPerUpload) {
				return res.status(400).send('Too many files');
			}
			file.data = Buffer.concat(file.data);
			if (file.data.length >= config.maxFileSize) {
				res.status(413).send('Payload too large');
				return req.destroy();
			}
			files.push(file);
		});
	}).on('error', err => {
		console.error('Dicer error: ' + err);
		return res.status(500).send('Internal Server Error');
		
	}).on('finish', () => {
		if (res._headersSent || res.finished) return;
		if (files.length === 0) {
			return res.status(500).send('Internal Server Error');
		}
		
		batchUpload(files).then(data => {
			if (data.length === 0) {
				console.error('batchUpload returned zero-length array.');
				return res.status(500).send('Internal Server Error');
			}
			if (data.length === 1 && data[0].error) {
				return res.status(500).send('Internal Server Error');
			}
			
			// Send success response
			let url = config.url+data[0].file;
			connection.query("INSERT INTO files (file, api, date, name, size) VALUES (?, ?, NOW(), ?, ?)", [data[0].file, api, data[0].name, data[0].size],
			function (error, results, fields) {
				if (error) {
					fs.unlink('public/uploads/'+data[0].file, err => {
						if(err) console.error('failed to delete ' + data[0].file + ': ' + err);
					});
					console.log("MySQL query failed: " + error);
					return res.status(500).send("MySQL query failed");
				}
				res.status(200).send(url);
			});
			
		}).catch(err => {
			console.error('Failed to batch upload:');
			console.error(err);
			res.status(500).send('Internal Server Error');
		});
	});
	
	// Pipe request into Dicer
	req.pipe(d);
});

var server = app.listen(config.port, function(){
  console.log('Server listening on port ' + config.port);
});



/**
 * Batch upload and return an array of metadata about each object.
 * @param {object[]} files File definitions
 * @return {Promise<object[]>} Output metadata
 */
function batchUpload (files) {
	return new Promise((resolve, reject) => {
		
		let completed = [];
		
		/**
		 * Push data to completed and try to resolve the promise.
		 * @param {object} data
		 */
		function push (data) {
			completed.push(data);
			if (completed.length === files.length) resolve(completed);
		}
		
		files.forEach(file => {
			const seed = String(Math.floor(Math.random() * 10) + Date.now());
			let hash = crypto.createHash('md5').update(seed).digest('hex').substr(2, 6);
			fs.writeFile('public/uploads/'+hash+"."+file.ext, file.data, 'binary', err => {
				if (err) throw err;
				console.log('file saved: ' + hash+"."+file.ext);
			});
			push({
				file: hash+"."+file.ext,
				name: file.filename,
				size: file.data.length
			});
		});
	});
}