$.ajaxSetup({
    headers: { "Content-Type": "application/json" }
});
document.onload = (function (d3, saveAs, Blob, undefined) {
    "use strict";

    // define graphcreator object
    var GraphCreator = function (svg, nodes, edges) {
        var thisGraph = this;
        thisGraph.idct = 0;

        thisGraph.nodes = nodes || [];
        thisGraph.edges = edges || [];

        thisGraph.state = {
            selectedNode: null,
            selectedEdge: null,
            mouseDownNode: null,
            mouseDownLink: null,
            justDragged: false,
            justScaleTransGraph: false,
            lastKeyDown: -1,
            shiftNodeDrag: false,
            selectedText: null
        };

        thisGraph.labelOffset = 15;

        // define arrow markers for graph links
        var defs = svg.append('svg:defs');
        defs.append('svg:marker')
            .attr('id', 'end-arrow')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', "18")
            .attr('markerWidth', 3.5)
            .attr('markerHeight', 3.5)
            .attr('orient', 'auto')
            .append('svg:path')
            .attr('d', 'M0,-5L10,0L0,5');

        // define arrow markers for leading arrow
        defs.append('svg:marker')
            .attr('id', 'mark-end-arrow')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 7)
            .attr('markerWidth', 3.5)
            .attr('markerHeight', 3.5)
            .attr('orient', 'auto')
            .append('svg:path')
            .attr('d', 'M0,-5L10,0L0,5');

        thisGraph.svg = svg;
        thisGraph.svgG = svg.append("g")
            .classed(thisGraph.consts.graphClass, true);
        var svgG = thisGraph.svgG;

        // displayed when dragging between nodes
        thisGraph.dragLine = svgG.append('svg:path')
            .attr('class', 'link dragline hidden')
            .attr('d', 'M0,0L0,0')
            .style('marker-end', 'url(#mark-end-arrow)');

        // svg nodes and edges 
        thisGraph.paths = svgG.append("g").selectAll("g");
        thisGraph.circles = svgG.append("g").selectAll("g");

        thisGraph.drag = d3.behavior.drag()
            .origin(function (d) {
                return { x: d.x, y: d.y };
            })
            .on("drag", function (args) {
                thisGraph.state.justDragged = true;
                thisGraph.dragmove.call(thisGraph, args);
            })
            .on("dragend", function () {
                // todo check if edge-mode is selected
            });

        // listen for key events
        d3.select(window).on("keydown", function () {
            thisGraph.svgKeyDown.call(thisGraph);
        })
            .on("keyup", function () {
                thisGraph.svgKeyUp.call(thisGraph);
            });
        svg.on("mousedown", function (d) { thisGraph.svgMouseDown.call(thisGraph, d); });
        svg.on("mouseup", function (d) { thisGraph.svgMouseUp.call(thisGraph, d); });

        window.abc = this.getAllPaths.bind(this);

        // listen for dragging
        var dragSvg = d3.behavior.zoom()
            .on("zoom", function () {
                if (d3.event.sourceEvent.shiftKey) {
                    // TODO  the internal d3 state is still changing
                    return false;
                } else {
                    thisGraph.zoomed.call(thisGraph);
                }
                return true;
            })
            .on("zoomstart", function () {
                var ael = d3.select("#" + thisGraph.consts.activeEditId).node();
                if (ael) {
                    ael.blur();
                }
                if (!d3.event.sourceEvent.shiftKey) d3.select('body').style("cursor", "move");
            })
            .on("zoomend", function () {
                d3.select('body').style("cursor", "auto");
            });

        svg.call(dragSvg).on("dblclick.zoom", null);

        // listen for resize
        window.onresize = function () { thisGraph.updateWindow(svg); };

        // controls
        d3.select("#epMethod").on("change", thisGraph.changeEPMethod.bind(this))
        d3.select("#runEvaluation").on("click", thisGraph.runEvaluation.bind(this));
        // handle delete graph
        d3.select("#delete-graph").on("click", function () {
            thisGraph.deleteGraph(false);
        });

        thisGraph.updateEdgesList();
        thisGraph.updateNodesList();
    };

    GraphCreator.prototype.changeEPMethod = function () {
        const methodId = parseInt($("#epMethod").val());
        switch (methodId) {
            case 1:
                $("#primaryPath, #secondaryPath").attr("disabled", "disabled");
                $(".hide-if-dijkstra").hide();
                break;
            case 2:
                $("#primaryPath, #secondaryPath").removeAttr("disabled");
                $(".hide-if-dijkstra").show();
                break;
            default:
                break;
        }
    }

    GraphCreator.prototype.setIdCt = function (idct) {
        this.idct = idct;
    };

    GraphCreator.prototype.consts = {
        selectedClass: "selected",
        connectClass: "connect-node",
        circleGClass: "conceptG",
        graphClass: "graph",
        activeEditId: "active-editing",
        DELETE_KEY: 46,
        ENTER_KEY: 13,
        nodeRadius: 25
    };

    /* PROTOTYPE FUNCTIONS */

    GraphCreator.prototype.dragmove = function (d) {
        var thisGraph = this;
        if (thisGraph.state.shiftNodeDrag) {
            thisGraph.dragLine.attr('d', 'M' + d.x + ',' + d.y + 'L' + d3.mouse(thisGraph.svgG.node())[0] + ',' + d3.mouse(this.svgG.node())[1]);
        } else {
            d.x += d3.event.dx;
            d.y += d3.event.dy;
            thisGraph.updateGraph();
        }
    };

    /* select all text in element: taken from http://stackoverflow.com/questions/6139107/programatically-select-text-in-a-contenteditable-html-element */
    GraphCreator.prototype.selectElementContents = function (el) {
        var range = document.createRange();
        range.selectNodeContents(el);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    };


    /* insert svg line breaks: taken from http://stackoverflow.com/questions/13241475/how-do-i-include-newlines-in-labels-in-d3-charts */
    GraphCreator.prototype.insertTitleLinebreaks = function (gEl, title) {
        var words = title.split(/\s+/g),
            nwords = words.length;
        var el = gEl.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "-" + (nwords - 1) * 7.5);

        for (var i = 0; i < words.length; i++) {
            var tspan = el.append('tspan').text(words[i]);
            if (i > 0)
                tspan.attr('x', 0).attr('dy', '15');
        }
    };


    // remove edges associated with a node
    GraphCreator.prototype.spliceLinksForNode = function (node) {
        var thisGraph = this,
            toSplice = thisGraph.edges.filter(function (l) {
                return (l.source === node || l.target === node);
            });
        toSplice.map(function (l) {
            thisGraph.edges.splice(thisGraph.edges.indexOf(l), 1);
        });
    };

    GraphCreator.prototype.replaceSelectEdge = function (d3Path, edgeData) {
        var thisGraph = this;
        d3Path.classed(thisGraph.consts.selectedClass, true);
        if (thisGraph.state.selectedEdge) {
            thisGraph.removeSelectFromEdge();
        }

        var failureRateEl = document.getElementById('failureRate');
        var repairRateEl = document.getElementById('repairRate');
        var linkLengthEl = document.getElementById('linkLength');
        failureRateEl.removeEventListener('change', this.changeNodeData);
        repairRateEl.removeEventListener('change', this.changeNodeData);
        failureRateEl.removeEventListener('change', this.changeEdgeData);
        repairRateEl.removeEventListener('change', this.changeEdgeData);

        linkLengthEl.removeEventListener('change', this.changeEdgeData);

        failureRateEl.value = edgeData.failureRate || 0;
        repairRateEl.value = edgeData.repairRate || 0;

        thisGraph.state.selectedEdge = edgeData;

        failureRateEl.addEventListener('change', this.changeEdgeData.bind(this));
        repairRateEl.addEventListener('change', this.changeEdgeData.bind(this));
        linkLengthEl.addEventListener('change', this.changeEdgeData.bind(this));

    };

    GraphCreator.prototype.changeEdgeData = function (e) {
        var thisGraph = this;
        var selectedEdge = thisGraph.state.selectedEdge;
        var id = e.target.getAttribute('id');
        this.edges.forEach(function (edge) {
            if (edge.source == selectedEdge.source && edge.target == selectedEdge.target) {
                edge[id] = parseFloat(e.target.value);
            }
        });

        thisGraph.updateEdgeLabels();
        thisGraph.updateEdgesList();
    }



    GraphCreator.prototype.replaceSelectNode = function (d3Node, nodeData) {
        var thisGraph = this;
        d3Node.classed(this.consts.selectedClass, true);
        if (thisGraph.state.selectedNode) {
            thisGraph.removeSelectFromNode();
        }

        var failureRateEl = document.getElementById('failureRate');
        var repairRateEl = document.getElementById('repairRate');
        failureRateEl.removeEventListener('change', this.changeNodeData);
        repairRateEl.removeEventListener('change', this.changeNodeData);
        failureRateEl.removeEventListener('change', this.changeEdgeData);
        repairRateEl.removeEventListener('change', this.changeEdgeData);

        failureRateEl.value = nodeData.failureRate || 0;
        repairRateEl.value = nodeData.repairRate || 0;

        thisGraph.state.selectedNode = nodeData;

        failureRateEl.addEventListener('change', this.changeNodeData.bind(this));
        repairRateEl.addEventListener('change', this.changeNodeData.bind(this));
    };

    GraphCreator.prototype.changeNodeData = function (e) {
        var thisGraph = this;
        var selectedNode = thisGraph.state.selectedNode;
        var id = e.target.getAttribute('id');
        this.nodes.forEach(function (node) {
            if (node.id == selectedNode.id) {
                node[id] = parseFloat(e.target.value);
            }
        });

        thisGraph.updateNodesList();
    }

    GraphCreator.prototype.removeSelectFromNode = function () {
        var thisGraph = this;
        thisGraph.circles.filter(function (cd) {
            return cd.id === thisGraph.state.selectedNode.id;
        }).classed(thisGraph.consts.selectedClass, false);
        thisGraph.state.selectedNode = null;
    };

    GraphCreator.prototype.removeSelectFromEdge = function () {
        var thisGraph = this;
        thisGraph
            .paths
            .filter(function (cd) {
                return cd === thisGraph.state.selectedEdge;
            })
            .select("path")
            .classed(thisGraph.consts.selectedClass, false);

        thisGraph.state.selectedEdge = null;
    };

    GraphCreator.prototype.pathMouseDown = function (d3path, d) {
        var thisGraph = this,
            state = thisGraph.state;
        d3.event.stopPropagation();
        state.mouseDownLink = d;

        thisGraph.disableLinkLength(false);

        if (state.selectedNode) {
            thisGraph.removeSelectFromNode();
        }

        var prevEdge = state.selectedEdge;
        if (!prevEdge || prevEdge !== d) {
            thisGraph.replaceSelectEdge(d3path, d);
        } else {
            thisGraph.removeSelectFromEdge();
        }

        $("#linkLength").val(d.linkLength || 0);
    };

    // mousedown on node
    GraphCreator.prototype.circleMouseDown = function (d3node, d) {
        var thisGraph = this,
            state = thisGraph.state;
        d3.event.stopPropagation();
        state.mouseDownNode = d;
        if (d3.event.shiftKey) {
            state.shiftNodeDrag = d3.event.shiftKey;
            // reposition dragged directed edge
            thisGraph.dragLine.classed('hidden', false)
                .attr('d', 'M' + d.x + ',' + d.y + 'L' + d.x + ',' + d.y);
            return;
        }
    };

    /* place editable text on node in place of svg text */
    GraphCreator.prototype.changeTextOfNode = function (d3node, d) {
        var thisGraph = this,
            consts = thisGraph.consts,
            htmlEl = d3node.node();
        d3node.selectAll("text").remove();
        var nodeBCR = htmlEl.getBoundingClientRect(),
            curScale = nodeBCR.width / consts.nodeRadius,
            placePad = 5 * curScale,
            useHW = curScale > 1 ? nodeBCR.width * 0.71 : consts.nodeRadius * 1.42;
        // replace with editableconent text
        var d3txt = thisGraph.svg.selectAll("foreignObject")
            .data([d])
            .enter()
            .append("foreignObject")
            .attr("x", nodeBCR.left + placePad)
            .attr("y", nodeBCR.top + placePad)
            .attr("height", 35)
            .attr("width", 100)
            .append("xhtml:div")
            .attr("style", "background-color: lightblue;height:100%;width:100%")
            .attr("id", consts.activeEditId)
            .attr("contentEditable", "true")
            .text(d.title)
            .on("mousedown", function (d) {
                d3.event.stopPropagation();
            })
            .on("keydown", function (d) {
                d3.event.stopPropagation();
                if (d3.event.keyCode == consts.ENTER_KEY && !d3.event.shiftKey) {
                    this.blur();
                }
            })
            .on("blur", function (d) {
                // lets try something
                var nodeTextContent = this.textContent;
                // d.failureRate = parseFloat(nodeTextContent.split(';')[0]);
                // d.repairRate = parseFloat(nodeTextContent.split(';')[1]);
                // console.log('%c Changed failure rate: ' + d.failureRate + ', repairRate: ' + d.repairRate, 'color: lightblue');
                d.title = this.textContent;
                thisGraph.insertTitleLinebreaks(d3node, d.title);
                d3.select(this.parentElement).remove();
                thisGraph.updateNodesList();
                thisGraph.updateNodeSelect();
            });
        return d3txt;
    };

    GraphCreator.prototype.disableLinkLength = function (shouldDisable) {
        var el = $("#linkLength");
        if (shouldDisable) {
            el.attr('disabled', 'disabled');
            el.val(null);
        }
        else {
            el.removeAttr('disabled');
        }
    }

    // mouseup on nodes
    GraphCreator.prototype.circleMouseUp = function (d3node, d) {
        var thisGraph = this,
            state = thisGraph.state,
            consts = thisGraph.consts;
        // reset the states
        state.shiftNodeDrag = false;
        d3node.classed(consts.connectClass, false);

        var mouseDownNode = state.mouseDownNode;

        if (!mouseDownNode) return;

        thisGraph.dragLine.classed("hidden", true);
        thisGraph.disableLinkLength(true);

        if (mouseDownNode !== d) {
            // we're in a different node: create new edge for mousedown edge and add to graph
            var newEdge = { source: mouseDownNode, target: d, linkLength: 1, repairRate: 0, failureRate: 0 };
            var filtRes = thisGraph.paths.filter(function (d) {
                if (d.source === newEdge.target && d.target === newEdge.source) {
                    thisGraph.edges.splice(thisGraph.edges.indexOf(d), 1);
                }
                return d.source === newEdge.source && d.target === newEdge.target;
            });
            if (!filtRes[0].length) {
                thisGraph.edges.push(newEdge);
                console.log('%c New EDGE created', 'color: yellow');
                console.log(newEdge);
                console.log('%c ==============', 'color: yellow');
                // thisGraph.updateEdgesList();
                thisGraph.updateGraph();
            }
        } else {
            // we're in the same node
            if (state.justDragged) {
                // dragged, not clicked
                state.justDragged = false;
            } else {
                // clicked, not dragged
                if (d3.event.shiftKey) {
                    // shift-clicked node: edit text content
                    var d3txt = thisGraph.changeTextOfNode(d3node, d);
                    var txtNode = d3txt.node();
                    thisGraph.selectElementContents(txtNode);
                    txtNode.focus();
                } else {
                    if (state.selectedEdge) thisGraph.removeSelectFromEdge();
                    var prevNode = state.selectedNode;

                    if (!prevNode || prevNode.id !== d.id) thisGraph.replaceSelectNode(d3node, d);
                    else thisGraph.removeSelectFromNode();
                }
            }
        }
        state.mouseDownNode = null;
        return;

    }; // end of circles mouseup

    GraphCreator.prototype.updateEdgeLabels = function () {
        var thisGraph = this;
        var paths = thisGraph.paths;
        paths
            .selectAll("text")
            .text(function (d) { return d.linkLength });
    };

    // mousedown on main svg
    GraphCreator.prototype.svgMouseDown = function () {
        this.state.graphMouseDown = true;
    };

    // mouseup on main svg
    GraphCreator.prototype.svgMouseUp = function () {
        var thisGraph = this,
            state = thisGraph.state;
        if (state.justScaleTransGraph) {
            // dragged not clicked
            state.justScaleTransGraph = false;
        } else if (state.graphMouseDown && d3.event.shiftKey) {
            // clicked not dragged from svg
            var xycoords = d3.mouse(thisGraph.svgG.node()),
                d = { id: thisGraph.idct++, title: "Č", x: xycoords[0], y: xycoords[1], failureRate: 0, repairRate: 0 };
            thisGraph.nodes.push(d);
            thisGraph.updateNodeSelect();
            console.log('%c New node created', 'color: lightgreen');
            console.log(d);
            console.log(thisGraph.nodes);
            console.log('%c ==============', 'color: lightgreen');

            thisGraph.updateGraph();
            // make title of text immediently editable
            var d3txt = thisGraph.changeTextOfNode(thisGraph.circles.filter(function (dval) {
                return dval.id === d.id;
            }), d),
                txtNode = d3txt.node();
            thisGraph.selectElementContents(txtNode);
            txtNode.focus();
        } else if (state.shiftNodeDrag) {
            // dragged from node
            state.shiftNodeDrag = false;
            thisGraph.dragLine.classed("hidden", true);
        }
        state.graphMouseDown = false;
    };

    // keydown on main svg
    GraphCreator.prototype.svgKeyDown = function () {
        var thisGraph = this,
            state = thisGraph.state,
            consts = thisGraph.consts;
        // make sure repeated key presses don't register for each keydown
        if (state.lastKeyDown !== -1) return;

        state.lastKeyDown = d3.event.keyCode;
        var selectedNode = state.selectedNode,
            selectedEdge = state.selectedEdge;

        switch (d3.event.keyCode) {
            case consts.DELETE_KEY:
                d3.event.preventDefault();
                if (selectedNode) {
                    thisGraph.nodes.splice(thisGraph.nodes.indexOf(selectedNode), 1);
                    thisGraph.spliceLinksForNode(selectedNode);
                    state.selectedNode = null;
                    thisGraph.updateGraph();
                } else if (selectedEdge) {
                    thisGraph.edges.splice(thisGraph.edges.indexOf(selectedEdge), 1);
                    state.selectedEdge = null;
                    thisGraph.updateGraph();
                }
                break;
        }
    };

    GraphCreator.prototype.svgKeyUp = function () {
        this.state.lastKeyDown = -1;
    };

    // call to propagate changes to graph
    GraphCreator.prototype.updateGraph = function () {

        var thisGraph = this,
            consts = thisGraph.consts,
            state = thisGraph.state;

        thisGraph.paths = thisGraph.paths.data(thisGraph.edges, function (d) {
            return String(d.source.id) + "+" + String(d.target.id);
        });
        var paths = thisGraph.paths;
        // update existing paths
        var paths = thisGraph.paths;
        paths
            .select("path")
            .style('marker-end', 'url(#end-arrow)')
            .classed(consts.selectedClass, function (d) {
                return d === state.selectedEdge;
            })
            .attr("d", function (d) {
                return "M" + d.source.x + "," + d.source.y + "L" + d.target.x + "," + d.target.y;
            });

        paths
            .select("text")
            .attr("dx", function (d) { return d.source.x + thisGraph.labelOffset + (d.target.x - d.source.x) * 0.5 })
            .attr("dy", function (d) { return d.source.y + (d.target.y - d.source.y) * 0.5 });

        var group = paths.enter()
            .append("g");

        group.append("path")
            .style('marker-end', 'url(#end-arrow)')
            .classed("link", true)
            .attr("d", function (d) {
                return "M" + d.source.x + "," + d.source.y + "L" + d.target.x + "," + d.target.y;
            })
            .on("mousedown", function (d) {
                thisGraph.pathMouseDown.call(thisGraph, d3.select(this), d);
            })
            .on("mouseup", function (d) {
                state.mouseDownLink = null;
            });

        group.append("text")
            .style({
                'font-weight': '500',
                'fill': 'white'
            })
            .attr("dx", function (d) { return d.source.x + thisGraph.labelOffset + (d.target.x - d.source.x) * 0.5 })
            .attr("dy", function (d) { return d.source.y + (d.target.y - d.source.y) * 0.5 })
            .text(function (d) { return d.linkLength });


        // remove old links
        paths.exit().remove();

        // update existing nodes
        thisGraph.circles = thisGraph.circles.data(thisGraph.nodes, function (d) { return d.id; });
        thisGraph.circles.attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; });

        // add new nodes
        var newGs = thisGraph.circles.enter()
            .append("g");

        newGs.classed(consts.circleGClass, true)
            .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; })
            .on("mouseover", function (d) {
                if (state.shiftNodeDrag) {
                    d3.select(this).classed(consts.connectClass, true);
                }
            })
            .on("mouseout", function (d) {
                d3.select(this).classed(consts.connectClass, false);
            })
            .on("mousedown", function (d) {
                thisGraph.circleMouseDown.call(thisGraph, d3.select(this), d);
            })
            .on("mouseup", function (d) {
                thisGraph.circleMouseUp.call(thisGraph, d3.select(this), d);
            })
            .call(thisGraph.drag);

        newGs.append("ellipse")
            .attr("id", "ellipse")
            .attr("style", "fill:#F39C12")
            // .attr("cx", "365.832")
            // .attr("cy", "265.546")
            .attr("rx", "34.048")
            .attr("ry", "30.113");

        newGs.append("ellipse")
            .attr("id", "ellipse-shadow")
            .attr("style", "fill:#F1C40F")
            // .attr("cx", "365.832")
            .attr("cy", "-3")
            .attr("rx", "34.048")
            .attr("ry", "28.282");

        newGs.each(function (d) {
            thisGraph.insertTitleLinebreaks(d3.select(this), d.title);
        });

        // remove old nodes
        thisGraph.circles.exit().remove();
    };

    GraphCreator.prototype.zoomed = function () {
        this.state.justScaleTransGraph = true;
        d3.select("." + this.consts.graphClass)
            .attr("transform", "translate(" + d3.event.translate + ") scale(" + d3.event.scale + ")");
    };

    GraphCreator.prototype.updateWindow = function (svg) {
        var docEl = document.documentElement,
            bodyEl = document.getElementsByTagName('body')[0];
        var x = window.innerWidth || docEl.clientWidth || bodyEl.clientWidth;
        var y = window.innerHeight || docEl.clientHeight || bodyEl.clientHeight;
        svg.attr("width", x).attr("height", y);
    };

    GraphCreator.prototype.updateNodesList = function () {
        var nodes = this.nodes;
        var container = document.getElementById('nodes-list');
        var tableBody = container.getElementsByTagName("tbody")[0];
        tableBody.innerHTML = ''

        var nodesHTML = nodes.map(function (node) {
            return `<tr><td>${node.title}</td><td>${node.failureRate}</td><td>${node.repairRate}</td></tr>`;
        }).join('');

        tableBody.innerHTML = nodesHTML;
    }

    GraphCreator.prototype.updateEdgesList = function () {
        var edges = this.edges;
        var container = document.getElementById('edges-list');
        var tableBody = container.getElementsByTagName("tbody")[0];
        tableBody.innerHTML = ''

        var edgesHTML = edges.map(function (edge) {
            return `<tr><td>${edge.source.title} - ${edge.target.title}</td><td>${edge.failureRate || 0}</td><td>${edge.repairRate || 0}</td><td>${edge.linkLength || 0}</td></tr>`;
        }).join('');

        tableBody.innerHTML = edgesHTML;
    }

    GraphCreator.prototype.getAllPaths = function (start, end) {
        var thisGraph = this;
        var network = thisGraph.edges.reduce(function (prev, curr) {
            if (!prev[curr.source.title]) prev[curr.source.title] = {};
            prev[curr.source.title][curr.target.title] = curr.linkLength;

            return prev;
        }, {});

        thisGraph
            .nodes
            .forEach(function (node) {
                if (!network.hasOwnProperty(node.title)) network[node.title] = {};
            });

        const data = {
            start: start,
            end: end,
            network: network
        };

        $.post('/dijkstra', JSON.stringify(data), function (res) {
            console.log(res);
        });
    }

    GraphCreator.prototype.updateNodeSelect = function (id) {
        var nodes = this.nodes.sort(function (a, b) { return a.title > b.title; }).map(function (d) {
            return "<option value='" + d.title + "'>" + d.title + "</option>";
        }).join("");

        $("#startNode").html(nodes);
        $("#endNode").html(nodes);
    }

    GraphCreator.prototype.runEvaluation = function () {
        $("#runEvaluation .text").hide();
        $("#runEvaluation .loading-spinner").addClass("in");

        var thisGraph = this;
        var nodes = thisGraph.nodes;
        var edges = thisGraph.edges;
        var startNode = $("#startNode").val() || null;
        var endNode = $("#endNode").val() || null;
        var epMethod = $("#epMethod").val() || null;
        var evaluationLevel = $("#evaluationLevel").val() || null;
        var time = $("#time").val() || null;
        var primaryPath = $("#primaryPath").val() || null;
        primaryPath = primaryPath ? primaryPath.split(",").map(function (p) { return p.trim(); }) : null;
        var secondaryPath = $("#secondaryPath").val() || null;
        secondaryPath = secondaryPath ? secondaryPath.split(",").map(function (p) { return p.trim(); }) : null;
        var network = thisGraph.edges.reduce(function (prev, curr) {
            if (!prev[curr.source.title]) prev[curr.source.title] = {};
            prev[curr.source.title][curr.target.title] = curr.linkLength;

            return prev;
        }, {});

        thisGraph
            .nodes
            .forEach(function (node) {
                if (!network.hasOwnProperty(node.title)) network[node.title] = {};
            });

        var data = {
            start: startNode,
            end: endNode,
            method: epMethod,
            evaluationLevel: evaluationLevel,
            primaryPath: primaryPath,
            secondaryPath: secondaryPath,
            network: network,
            nodes: nodes.slice().map(function (n) {
                n['reliability'] = Math.exp(-(n.failureRate / Math.pow(10, 9)) * parseInt(time));
                n['availability'] = n.repairRate / (n.repairRate + (n.failureRate / Math.pow(10, 9)));
                return n;
            }),
            edges: edges.slice().map(function (e) {
                e['stringId'] = e.source.title + e.target.title;
                e['reliability'] = Math.exp(-(e.failureRate / Math.pow(10, 9)) * parseInt(time));
                e['availability'] = e.repairRate / (e.repairRate + (e.failureRate / Math.pow(10, 9)));
                return e;
            })
        };

        $.post('/evaluation', JSON.stringify(data), function (res) {
            setTimeout(function () {
                $("#runEvaluation .text").show();
                $("#runEvaluation .loading-spinner").removeClass("in");
            }, 1500);
            console.log(res);
        });
    }

    /**** MAIN ****/

    // warn the user when leaving
    window.onbeforeunload = function () {
        return "Make sure to save your graph locally before leaving :-)";
    };

    var docEl = document.documentElement,
        bodyEl = document.getElementsByTagName('body')[0];

    var width = window.innerWidth || docEl.clientWidth || bodyEl.clientWidth,
        height = window.innerHeight || docEl.clientHeight || bodyEl.clientHeight;

    var xLoc = width / 2 - 25,
        yLoc = height / 3;

    // initial node data
    var nodes = [{ title: "Č1", id: 0, x: xLoc, y: yLoc, repairRate: 0, failureRate: 0 },
    { title: "Č2", id: 1, x: xLoc, y: yLoc + 200, repairRate: 0, failureRate: 0 }];
    var edges = [{ source: nodes[1], target: nodes[0], linkLength: 1, repairRate: 0, failureRate: 0 }];


    /** MAIN SVG **/
    var svg = d3.select("body").append("svg")
        .attr("width", '100%')
        .attr("height", '100vh');
    var graph = new GraphCreator(svg, nodes, edges);
    graph.setIdCt(2);
    graph.updateGraph();
})(window.d3, window.saveAs, window.Blob);