var express = require('express');
var router = express.Router();

var multiparty = require('multiparty');
var util = require('util');

const csv = require('csv-parse');

var mysql = require('mysql');
var async = require('async');

var postResults = [];

/*function getBatch(c, callback) {
  c.query('SELECT MAX(batch_num) AS batch FROM customers', (err, result) => {
    if (err) return callback(true, err);
    console.log("Result: " + result);
    console.log("New batch: " + batch);
    return callback(null, Number(result[0].batch) + 1);
  });
}*/

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
  async.series([
    function(){
      var con = mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "Le0dav!s",
        database: "firebase_app_sql"
      });

      con.connect();
    },
    function(){
      var form = new multiparty.Form();

      // format date in desired yyyy-mm-dd format
      //var date = new Date().toISOString()
      //          .replace(/T.*/, '');

      form.on('error', (err) => {
        console.log('Error parsing form: ' + err.stack);
        res.render('index', { title: 'Choose an Option', success: false });
      });

      form.on('part', (part) => {
        if (!part.filename) {
          console.log('got field named ' + part.name);
          part.resume();
        }

        if (part.filename) {
          console.log('got file name ' + part.name);
          
          // pipe the readstream data to the csv parser
          part.pipe(csv()).on('data', (data) => {
            console.log(data);

            postResults.push(data);

            // skip the header row
            if (data[0] !== 'batch_num') {

              var sql = `INSERT INTO customers (batch_num, date_userID_created, snn, \
                          gender, first_name, last_name, lic_num, birthdate, \
                          points_strike, dl_class) VALUES (${data[0]}, '${data[1]}', '${data[2]}', \
                          '${data[3]}', '${data[4]}', '${data[5]}', '${data[6]}', \
                          '${data[7]}', '${data[8]}', '${data[9]}')`;
              con.query(sql, function(err, result) {
                if (err) throw err;
                console.log("1 record inserted");
              });

            }

          });
          part.resume();
        }

        part.on('error', (err) => {
          console.log('part error: ' + err.stack);
          res.render('index', { title: 'Choose an Option', success: false });
        });
      });

      // Close emitted after form parsed
      form.on('close', function() {
        console.log('Upload completed!');
        res.end();
      });

      form.parse(req);
    },
    function(){
      res.render('upload-success', { title: 'Successfully uploaded file', results: postResults });
    }
  ]);
});

module.exports = router;
