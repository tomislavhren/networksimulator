const Graph = require('node-all-paths');
const network = {
    a: { b: 1, c: 3 },
    b: { c: 5, d: 2 },
    c: { d: 4 },
    d: {}
};

function Dijkstra(start, end, network) {
    const graph = new Graph(network);
    let paths = [];
    try {
        paths = graph.path(start, end);
    } catch (error) {
        return { err: 'Vjerojatno postoje ciklusi u mreži' };
    }

    let result = [];
    paths.forEach(function (p) {
        result.push({
            path: p,
            cost: getCost(p)
        });
    });

    result.sort(function (a, b) { return a.cost - b.cost; })

    function getCost(path) {
        var sum = 0;
        var firstNode = path.shift();
        var node = network[firstNode];
        path.forEach(function (n) {
            sum += parseInt(node[n]) || 0;
            node = network[n];
        });
        path.unshift(firstNode);

        return sum;
    }

    return result;
}

module.exports = Dijkstra;