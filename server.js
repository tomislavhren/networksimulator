var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var dijkstra = require('./djikstra.js');

// set the port of our application
// process.env.PORT lets the port be set by Heroku
var port = process.env.PORT || 8080;

// set the view engine to ejs
app.set('view engine', 'ejs');

app.use(express.static(__dirname));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// set the home page route
app.get('/', function (req, res) {
    // ejs render automatically looks in the views folder
    res.render('index');
});

app.post('/dijkstra', function (req, res) {
    try {
        const data = req.body;
        res.json(dijkstra(data.start, data.end, data.network));
    } catch (error) {
        res.status(500).json(error);
    }
});

app.listen(port, function () {
    console.log('Our app is running on http://localhost:' + port);
});