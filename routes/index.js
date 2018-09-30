var express = require('express');
var router = express.Router();

// contains connection string info for MySQL
var config = require('../config');

// for handling CSV info from post data
var Busboy = require('busboy');
var util = require('util');
const csv = require('csv-string');

var mysql = require('mysql');

// firebase setup
const admin = require('firebase-admin');
var serviceAccount = require('../fir-app-9ddd7-firebase-adminsdk-1l3th-0895c82b20.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

var db = admin.firestore();
db.settings({ timestampsInSnapshots: true });
// end firebase setup

// function to sort CSV data
// sorts by date_userID_created
// then by birthdate
function sortFunction(a, b) {
    if (a[1] === b[1]) {
        if (a[7] === b[7]) {
          return 0;
        }
        else {
          return (a[7] < b[7]) ? -1 : 1;
        }
    }
    else {
        return (a[1] < b[1]) ? -1 : 1;
    }
}

// Firestore listener
db.collection("customers")
  .onSnapshot(function(snapshot) {
    snapshot.docChanges.forEach(function(change) {
      if (change.type === "added") {
        console.log("New customer: ", change.doc.data());
      }
      if (change.type === "modified") {
        console.log("Modified customer: ", change.doc.data());
      
        var con = new Database();
        con.query(`UPDATE customers \
                    SET batch_num = ${mysql.escape(change.doc.data().batch_num)}
                      ,date_userID_created = ${mysql.escape((change.doc.data().date_userID_created).split('T')[0])}
                      ,snn = ${mysql.escape(change.doc.data().snn)}
                      ,gender = ${mysql.escape(change.doc.data().gender)}
                      ,first_name = ${mysql.escape(change.doc.data().first_name)}
                      ,last_name = ${mysql.escape(change.doc.data().last_name)}
                      ,lic_num = ${mysql.escape(change.doc.data().lic_num)}
                      ,birthdate = ${mysql.escape((change.doc.data().birthdate).split('T')[0])}
                      ,points_strike = ${mysql.escape(change.doc.data().points_strike)}
                      ,dl_class = ${mysql.escape(change.doc.data().dl_class)}
                    WHERE unique_id = ${mysql.escape(change.doc.data().unique_id)}`)
          .then(() => {
            return con.close();
          });
      }
      if (change.type === "removed") {
        console.log("Removed customer: ", change.doc.data());
      }
    });
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
    console.log(typeof CSVData);

    let valid = true;

    // validate CSV data and insert into MySQL if valid
    con.query("START TRANSACTION")
      .then( () => {
        CSVData.forEach(data => {
          console.log(data.length);
          console.log(data[1]);
          if (data.length === 10 && /^\d+$/.test(data[0]) && /^(19|20)\d\d-\d\d-\d\d$/.test(data[1]) && /^\d{9}$/.test(data[2]) && /^m|f$/.test(data[3]) && /^[a-z ,.'-]+$/.test(data[4]) && /^[a-z ,.'-]+$/.test(data[5]) && /^\w+$/.test(data[6]) && /^(19|20)\d\d-\d\d-\d\d$/.test(data[7]) && /^\d+$/.test(data[8]) && /^[a-zA-Z]$/.test(data[9])) {
            con.query(`INSERT INTO customers (batch_num, date_userID_created, snn, \
              gender, first_name, last_name, lic_num, birthdate, \
              points_strike, dl_class) VALUES (${mysql.escape(data[0])}, ${mysql.escape(data[1])}, ${mysql.escape(data[2])}, \
              ${mysql.escape(data[3])}, ${mysql.escape(data[4])}, ${mysql.escape(data[5])}, ${mysql.escape(data[6])}, \
              ${mysql.escape(data[7])}, ${mysql.escape(data[8])}, ${mysql.escape(data[9])})`);
            console.log('1 row inserted');
          }
          else {
            console.log('CSV row invalid');
            valid = false;
          }
        });
      })
      .then ( () => {
        console.log("Value of valid variable: " + valid);
        if (valid) {
          console.log("CSV valid. Committing.");
          con.query("COMMIT");
          res.render('upload-success', { title: 'CSV Uploaded!', results: CSVData.sort(sortFunction) });
        }
        else {
          console.log("CSV invalid. Rolling back.");
          con.query("ROLLBACK")
            .then( () => {
              res.redirect('/invalid-csv');
            });
        }
      });
  });
  req.pipe(busboy);
});

// Choose records to push to firestore
router.get('/push', function(req, res, next) {
  var con = new Database();

  let options;

  con.query(`SELECT * FROM customers WHERE pushed_to_firebase = 'N' ORDER BY date_userID_created, birthdate`)
    .then( rows => {
      options = rows;
      return con.close();
    })
    .then( () => {
      console.log(options);
      res.render('push', { title: 'Choose which files to Push to Firebase', options: options });
    });
});

// push the selected records to the firestore
router.post('/push-firebase', function(req, res, next) {
  var con = new Database();

  console.log('POST: ' + util.inspect(req.body));

  var postData = JSON.stringify(req.body, null, 2);
  var postData = JSON.parse(postData);

  Object.keys(postData).forEach(function(box) {
    console.log(box + ' - ' + postData[box]);

    if (/^\d+$/.test(postData[box])) {
      let row;

      con.query(`SELECT * FROM customers WHERE unique_id = ${mysql.escape(postData[box])}`)
        .then( rows => {
          row = JSON.stringify(rows[0]);
          row = JSON.parse(row);
          row.birthdate = new Date(row.birthdate);
          row.date_userID_created = new Date(row.date_userID_created);
          row.snn = Number(row.snn);
          row.unique_id = Number(row.unique_id);
          row.points_strike = Number(row.points_strike);
        })
        .then( () => {
          console.log('Row Data: ' + row);
          console.log(typeof row);
          console.log(row.birthdate)
          var setDoc = db.collection('customers').doc(String(postData[box])).set(row);
        })
        .then(() => {
          return con.query(`UPDATE customers SET pushed_to_firebase = 'Y' WHERE unique_id = ${mysql.escape(postData[box])}`);
        });
    }
  });

  res.render('index', {title: 'Choose an Option', success: 'pushed'});
});

// view SQL data for rows which have been pushed to firestore
router.get('/pushed', function(req, res, next) {
  var con = new Database();

  let queryResults;

  con.query("SELECT * FROM customers WHERE pushed_to_firebase = 'Y' ORDER BY date_userID_created, birthdate")
    .then( rows => {
      queryResults = rows;
    })
    .then( () => {
      con.close();
      res.render('pushed', {title: 'SQL Data that has been pushed', results: queryResults});
    });
});

router.get('/invalid-csv', function(req, res, next) {
  res.render('index', {title: 'Choose an Option', success: 'invalid-csv'})
});

module.exports = router;
