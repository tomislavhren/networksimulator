var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var dijkstra = require('./djikstra.js');
var abraham = require('./abraham');

// set the port of our application
// process.env.PORT lets the port be set by Heroku
var port = process.env.PORT || 3000;

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

app.post('/evaluation', function (req, res) {
    const edges = req.body
        .edges
        .map(function (p) {
            p["isIncludedInPath"] = null;
            p["sourceTitle"] = p.source.title;
            p["targetTitle"] = p.target.title;
            return p;
        });
    const nodes = req.body
        .nodes
        .map(n => {
            n["isIncludedInPath"] = null;
            return n;
        });

    let primaryPath = [];
    let secondaryPath = [];
    switch (req.body.method) {
        case "2": // voluntary choosen path
            primaryPath = req.body.primaryPath;
            secondaryPath = req.body.secondaryPath;
            break;
        case "1": // dijkstra algorithm paths
            var dijkstraPaths = dijkstra(req.body.start, req.body.end, req.body.network);
            primaryPath = dijkstraPaths[0].path;
            secondaryPath = dijkstraPaths[1].path;
            break;
    }

    const disjointProducts = abraham(nodes, edges, primaryPath, secondaryPath, req.body.start, req.body.end);

    let reliabilityBetweenNodes = 0;
    let availabilityBetweenNodes = 0;
    disjointProducts.forEach(function (product) {
        console.log(product.filter(p => p.isIncludedInPath != null).map(p => `${p.stringId} (${p.isIncludedInPath})`))
        let productReliability = 1;
        let productAvailability = 1;
        product.forEach(function (edge) {
            switch (edge.isIncludedInPath) {
                case true:
                    productReliability *= edge.reliability;
                    productAvailability *= edge.availability;
                    break;
                case false:
                    productReliability *= 1 - edge.reliability;
                    productAvailability *= 1 - edge.availability;
                    break;
                default:
                    break;
            }
        });
        reliabilityBetweenNodes += productReliability;
        availabilityBetweenNodes += productAvailability;
    });

    res.status(200).json({
        availabilty: availabilityBetweenNodes,
        reliability: reliabilityBetweenNodes,
        start: req.body.start,
        end: req.body.end,
        primaryPath: primaryPath,
        secondaryPath: secondaryPath,
        disjointProducts: disjointProducts
    });
});

app.listen(port, function () {
    console.log('Our app is running on PORT ' + port);
});