ShareZ
===================

A file managing client, written in **NodeJS**. Currently handles files via a local **filesystem** and a **MySQL server**. The code is not user-friendly yet, so you may have issues *(eg. no MySQL table setup query)*.
**Amazon S3** will be another option in the next updates.

###Current npm dependencies:
1. npm install express
2. npm install ejs
3. npm install mysql
4. npm install dicer


###To set up a MySQL table:
Your table structure should look like the following:
|#  |name |datatype |Length/Set|Unsigned|Allow NULL|Zerofill|Default|
|---|---|---|---|:---:|:---:|:---:|---|
|1. |file|TEXT|-|X|X|X|-
|2. |api|TEXT|-|X|X|X|-
|3. |date|DATE|-|X|X|X|-
|4. |name|TEXT|-|X|X|X|-
|5. |size|BIGINT|20|X|X|X|-

The primary key is *file*.