ShareZ
===================

A file managing client, written in **NodeJS**. Currently handles files via a local **filesystem** and a **MySQL server**. The code is not user-friendly yet, so you may have issues *(eg. no MySQL table setup query)*.
**Amazon S3** will be another option in the next updates.

### Current npm dependencies:
1. npm install express
2. npm install ejs
3. npm install mysql
4. npm install dicer


### To set up a MySQL table:
Your table structure should look like the following:

| # | name | datatype | Length/Set | Unsigned? | Allow NULL? | Zerofill? | Default | Description |
|----|------|----------|------------|:---------:|:-----------:|:---------:|---------|---------------------------------------|
| 1. | file | TEXT | - | X | X | X | - | The hash filename, stored on the disk |
| 2. | api | TEXT | - | X | X | X | - | The API used to upload the file |
| 3. | date | DATE | - | X | X | X | - | The date this file was published on |
| 4. | name | TEXT | - | X | X | X | - | The original filename (not hash) |
| 5. | size | BIGINT | - | X | X | X | - | The size of the file, in bytes |

The primary key is *file*.