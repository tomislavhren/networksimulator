function Abraham(nodes, edges, primaryPath, secondaryPath) {
    const primaryPathEdges = extractEdgesPath(edges, primaryPath);
    const secondaryPathEdges = extractEdgesPath(edges, secondaryPath);
    let s1 = [];
    let s2 = [];
    s1 = s1.concat([primaryPathEdges, secondaryPathEdges].sort(function (a, b) { return a.length - b.length; })[0]);
    s2 = s2.concat([primaryPathEdges, secondaryPathEdges].sort(function (a, b) { return a.length - b.length; })[1]);
    edges.forEach(function (edge) {

        var s1HasEdge = s1.filter(function (e) {
            return e.sourceTitle == edge.sourceTitle && e.targetTitle == edge.targetTitle;
        })[0];
        var s2HasEdge = s2.filter(function (e) {
            return e.sourceTitle == edge.sourceTitle && e.targetTitle == edge.targetTitle;
        })[0];

        if (!s1HasEdge) s1.push(edge);
        if (!s2HasEdge) s2.push(edge);

    });

    const x = compare(s2, s1);

    /**
     * s2 and s1 are disjoint
     */
    if (!Array.isArray(x) && x == 1) return [s1, s2];

    /**
     * x1*P, x1x2*P, x1x2x3*P.....
     * ex. 12, 25
     */
    let forSwap = [];
    for (var i = 0; i < x.length; i++) {

        let newArr = x.slice(0, i + 1);
        newArr = newArr.map(function (d) {
            d.isIncludedInPath = true;
            return d;
        })
        newArr[newArr.length - 1].isIncludedInPath = false;

        let newArrObj = newArr.reduce(function (prev, curr) {
            prev[curr.stringId] = curr.isIncludedInPath;
            return prev;
        }, {});

        x.forEach(function (d) {
            if (!newArrObj.hasOwnProperty(d.stringId)) newArrObj[d.stringId] = null;
        });

        forSwap.push(newArrObj);
    }

    let result = [s1];
    forSwap.forEach(function (sw) {
        let obj = s2.slice().map(function(r) {
            return {
                stringId: r.stringId,
                isIncludedInPath:  sw[r.stringId] != undefined ? sw[r.stringId] : r.isIncludedInPath,
                reliability: r.reliability,
                availability: r.availability
            }
        });

        result.push(obj);
    });


    return result;

    // return X
    function compare(s2, s1) {
        let x = [];
        s1.forEach(function (s1Edge) {
            let s2Edge = s2.filter(function (e) {
                return e.sourceTitle == s1Edge.sourceTitle && e.targetTitle == s1Edge.targetTitle;
            })[0];

            if (s1Edge.isIncludedInPath == true && s2Edge.isIncludedInPath == false) x = 1; // disjunktni su
            if (s1Edge.isIncludedInPath == true && s2Edge.isIncludedInPath == null)
                x.push({
                    failureRate: s1Edge.failureRate,
                    isIncludedInPath: s1Edge.isIncludedInPath,
                    linkLength: s1Edge.linkLength,
                    repairRate: s1Edge.repairRate,
                    sourceTitle: s1Edge.source.title,
                    targetTitle: s1Edge.target.title,
                    source: s1Edge.source,
                    target: s1Edge.target,
                    stringId: s1Edge.stringId
                });
        });

        return x;
    }

    function extractEdgesPath(edges, path) {
        let result = [];
        for (var i = 1; i < path.length; i++) {
            let p = edges
                .filter(function (d) {
                    return d.sourceTitle == path[i - 1] && d.targetTitle == path[i];
                })[0];

            result.push({
                failutreRate: p.failutreRate,
                availability: p.availability,
                reliability: p.reliability,
                isIncludedInPath: true,
                linkLength: p.linkLength,
                repairRate: p.repairRate,
                sourceTitle: p.source.title,
                targetTitle: p.target.title,
                source: p.source,
                target: p.target,
                stringId: p.stringId
            });
        }
        return result || [];
    }

}

module.exports = Abraham;