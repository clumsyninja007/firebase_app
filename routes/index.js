var express = require('express');
var router = express.Router();

//var env = process.env.NODE_ENV || 'development';
var config = require('../config');

var Busboy = require('busboy');
var util = require('util');

const csv = require('csv-string');

var mysql = require('mysql');

var postResults = [];


const admin = require('firebase-admin');
//const functions = require('firebase-functions');

var serviceAccount = require('../fir-app-9ddd7-firebase-adminsdk-1l3th-0895c82b20.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

var db = admin.firestore();
db.settings({ timestampsInSnapshots: true });

// Firestore listener
var query = db.collection('customers');

var observer = query.onSnapshot(querySnapshot => {
  console.log(`Received query snapshot of size ${querySnapshot.size}`);
  querySnapshot.docs.forEach((doc) => {
    console.log(doc.id);
    console.log(doc.updateTime);
  });
}, err => {
  console.log(`Encountered error: ${err}`);
});
// end firestore listener

class Database {
  constructor() {
    this.connection = mysql.createConnection(config.development.database);
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
// Then, display results
router.post('/upload-success', function(req, res, next) {
  var con = new Database();

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

// Choose records to push to firestore
router.get('/push', function(req, res, next) {
  var con = new Database();

  let options;

  con.query(`SELECT * FROM customers WHERE pushed_to_firebase = 'N'`)
    .then( rows => {
      options = rows;
      return con.close();
    })
    .then( () => {
      console.log(options);
      res.render('push', { title: 'Choose which files to Push to Firebase', options: options });
    });
});

router.post('/push-firebase', function(req, res, next) {
  var con = new Database();

  console.log('POST: ' + util.inspect(req.body));

  var postData = JSON.stringify(req.body, null, 2);
  var postData = JSON.parse(postData);

  Object.keys(postData).forEach(function(box) {
    console.log(box + ' - ' + postData[box]);

    let row;

    con.query(`SELECT * FROM customers WHERE unique_id = ${postData[box]}`)
      .then( rows => {
        row = JSON.stringify(rows[0]);
        row = JSON.parse(row);
      })
      .then( () => {
        console.log('Row Data: ' + row);
        console.log(typeof row);
        console.log(row.birthdate)
        var setDoc = db.collection('customers').doc(String(postData[box])).set(row);
      })
      .then(() => {
        return con.query(`UPDATE customers SET pushed_to_firebase = 'Y' WHERE unique_id = ${postData[box]}`);
      });
  });

  res.render('index', {title: 'Data Pushed', success: true});
});

module.exports = router;
