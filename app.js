const express = require('express');
const app = express();
const port=8080;
const path = require('path');
const expressLayout = require('express-ejs-layouts');
const cors = require('cors');
app.set('views', path.join(__dirname,'views'));
app.set('view engine','ejs');
app.use("/styles",express.static(__dirname + "/styles"));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(expressLayout);
app.use(express.static(path.join(__dirname, "client")));
const session = require('express-session')
var connection = require('./connection.js')
const dotenv = require('dotenv');
dotenv.config();


app.use(session({secret: 'anything',saveUninitialized: true,resave: true}));

app.use(function(req, res, next) {
    res.locals = req.session;
    next();
  })

  
  connection.connectToServer( function( err, client ) {
    if (err) console.log(err);
    // start the rest of your app here
    app.use('/',require('./routes/router.js'));
    app.use('/',require('./routes/notify.js'));
  } );

app.listen(port,function(){
    console.log("Started running");
});

