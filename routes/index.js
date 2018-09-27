var express = require('express');
var router = express.Router();

var Busboy = require('busboy');
var util = require('util');

const csv = require('csv-string');

var mysql = require('mysql');

var postResults = [];

/*
var sql = `INSERT INTO customers (batch_num, date_userID_created, snn, \
  gender, first_name, last_name, lic_num, birthdate, \
  points_strike, dl_class) VALUES (${data[0]}, '${data[1]}', '${data[2]}', \
  '${data[3]}', '${data[4]}', '${data[5]}', '${data[6]}', \
  '${data[7]}', '${data[8]}', '${data[9]}')`;
con.query(sql, function(err, result) {
if (err) throw err;
console.log("1 record inserted");
});
*/

class Database {
  constructor(config) {
    this.connection = mysql.createConnection(config);
  }
  query(sql,args) {
    return new Promise((resolve, reject) => {
      this.connection.query(sql,args,(err,rows) => {
        if (err)
          return reject(err);
        resolve(rows);
      });
    });
  }
  close() {
    return new Promise((resolve, reject) => {
      this.connection.end(err => {
        if (err)
          return reject(err);
        resolve();
      });
    });
  }
}

// Home page
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Choose an Option' });
});

// File upload page
router.get('/upload', function(req, res, next) {
  res.render('upload', { title: 'Upload a CSV' });
});

// Insert data from uploaded file to MySQL
router.post('/upload-success', function(req, res, next) {
  var con = new Database({
    host: "localhost",
    user: "root",
    password: "Le0dav!s",
    database: "firebase_app_sql"
  });

  var busboy = new Busboy({ headers: req.headers });
  CSVData = [];
  busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
    console.log('File [' + fieldname + ']: filename: ' + filename + ', encoding: ' + encoding + ', mimetype: ' + mimetype);
    if (mimetype === 'text/csv') {
      var buffer = '';
      file.on('data', function(data) {
        console.log('File [' + fieldname + '] got ' + data.length + ' bytes');
        buffer += data;
        //CSVData = csv();
      });
      file.on('end', function() {
        console.log('File [' + fieldname + '] Finished');
        CSVData.push(buffer);
        //console.log('File: ' + util.inspect(file));
      });
    }
    else {
      file.on('end', function() {
        console.log('Non-CSV file uploaded');
      });
    }
  });
  busboy.on('finish', function() {
    console.log('Done parsing form!');
    CSVData = csv.parse(CSVData[0]);
    console.log('First element of CSV Data: ' + CSVData[0]);
    //console.log(util.inspect(CSVData[0]));
    if (CSVData[0][0] === 'batch_num') {
      CSVData.shift();
      console.log('Removing header row...');
    }
    console.log('Final CSV Data: ' + CSVData);

    CSVData.forEach(data => {
      con.query(`INSERT INTO customers (batch_num, date_userID_created, snn, \
        gender, first_name, last_name, lic_num, birthdate, \
        points_strike, dl_class) VALUES (${data[0]}, '${data[1]}', '${data[2]}', \
        '${data[3]}', '${data[4]}', '${data[5]}', '${data[6]}', \
        '${data[7]}', '${data[8]}', '${data[9]}')`);
      console.log('1 row inserted');
    });

    res.render('upload-success', { title: 'CSV Uploaded!', results: CSVData });
  });
  req.pipe(busboy);
});

module.exports = router;
