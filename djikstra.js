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

    result.sort(function (a, b) { return a.cost - b.cost; });

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

    const primary = result[0];
    let temp = result[0].path.slice();
    temp.pop();
    temp.shift();
    
    const secondary = result.find((d) => {
        var containsEdge = false;
        for (var i = 1; i < d.path.length; i++) {
            var index1 = primary.path.indexOf(d.path[i - 1]);
            var index2 = primary.path.indexOf(d.path[i]);

            if (index1 > -1 && index2 > -1 && (index2 == index1 + 1))
                containsEdge = true;
        }

        // return !d.path.some(n => temp.indexOf(n) > -1);
        return !containsEdge;
    });

    return [primary, secondary];
}

module.exports = Dijkstra;