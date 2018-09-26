var express = require('express');
var router = express.Router();

var multiparty = require('multiparty');
var util = require('util');

var csv = require('csv');
/*
function MyCSV(batch_num, date_userID_created, snn, gender, first_name, last_name, lic_num, birthdate, points_strike, dl_class) {
  this.batch_num = batch_num;
  this.date_userID_created = date_userID_created;
  this.snn = snn;
  this.gender = gender;
  this.first_name = first_name;
  this.last_name = last_name;
  this.lic_num = lic_num;
  this.birthdate = birthdate;
  this.points_strike = points_strike;
  this.dl_class = dl_class;
};
*/
/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/upload', function(req, res, next) {
  res.render('upload', { title: 'Express' });
});

router.post('/', function(req, res, next) {
  var form = new multiparty.Form();
  var count = 0;

  form.on('error', (err) => {
    console.log('Error parsing form: ' + err.stack);
  });

  form.on('part', (part) => {
    if (!part.filename) {
      console.log('got field named ' + part.name);
      part.resume();
    }

    if (parent.filename) {
      count++;
      console.log('got file name ' + part.name);
      part.resume();
    }

    part.on('error', (err) => {
      part.resume();
    });
  });

  form.parse(req);

  res.render('index', { title: 'Express' });

  return;
});

module.exports = router;
