var currentWidth = document.body.clientWidth;
var currentHeight = document.body.clientHeight;
var DAY_DURATION = 2000;
var SECOND_TO_DAY_RATIO = 60 * 60 * 24;

var svg = d3.select("body")
    .append("svg")
    .attr("class", "map")
    .attr("width", currentWidth)
    .attr("height", currentHeight);

var projection = d3.geoMercator()
    .scale(Math.round(100 * (currentHeight / 465))) // TODO also handle height > width style ratio
    .translate([currentWidth / 2, currentHeight / 1.5]);

var path = d3.geoPath()
    .pointRadius(2)
    .projection(projection);

var app = new PIXI.Application({
    width: currentWidth,
    height: currentHeight,
    transparent: true
});
app.view.className = 'flights';
document.body.appendChild(app.view);

var points = [];
var ticker = new PIXI.ticker.Ticker();

var realTime = 0;
var animationTime = 0;
ticker.add(function (deltaTime) {
    realTime += (deltaTime / 100);
    animationTime = realTime;
    d3.select(".date").text(animationTime);

    for (var i = points.length - 1; i >= 0; i--) {
        var point = points[i];
        if (point.visible) {
            if (point.data.delay + point.data.duration >= animationTime) {
                // point.visible = false;
                // points.splice(i, 1);
            }
            // var newPosition = point.data.route(time / 100.0);
            // point.x = newPosition[0];
            // point.y = newPosition[1];
        } else if (point.data.delay >= animationTime) {
            point.visible = true;
        }
    }
});

function delta(path) {
    var l = path.getTotalLength();
    return function (t) {
        var p = path.getPointAtLength(t * l);
        return [p.x, p.y];
    }
}

function loaded(error, countries, airports, flights) {
    svg.append("g")
        .attr("class", "countries")
        .selectAll("path")
        .data(topojson.feature(countries, countries.objects.countries).features)
        .enter()
        .append("path")
        .attr("d", path);

    var airportsFeatures = topojson.feature(airports, airports.objects.airports).features;
    var airportCoordinates = {};
    for (var i = 0; i < airportsFeatures.length; i++) {
        var airportFeature = airportsFeatures[i];
        airportCoordinates[airportFeature.id] = airportFeature.geometry.coordinates;
    }

    /*svg.append("g")
        .attr("class", "airports")
        .selectAll("path")
        .data(airportsFeatures)
        .enter()
        .append("path")
        .attr("id", function(d) {
            return d.id;
        })
        .attr("d", path);*/

    var animationDuration = 31 * DAY_DURATION;
    var dateInterpolation = d3.interpolateNumber(0, 31);
    var startDate = moment("2018-04-01");

    d3.select(".date")
        .transition()
        .duration(animationDuration)
        .on("start", function () {
            d3.active(this)
                .tween("text", function () {
                    var that = d3.select(this);
                    return function (t) {
                        var dayAdded = Math.round(dateInterpolation(t));
                        //that.text(moment(startDate).add(dayAdded, 'days').format('DD/MM/YYYY'));
                    };
                })
                .ease(d3.easeLinear);
        });

    for (var i = 0; i < /*flights.length*/ 20; i++) {
        var flight = flights[i];

        var flightStart = moment(flight['BEGIN_DATE']);
        var flightEnd = moment(flight['END_DATE']);
        var delay = flightStart.diff(startDate, 'seconds') / SECOND_TO_DAY_RATIO;
        var duration = flightEnd.diff(flightStart, 'seconds') / SECOND_TO_DAY_RATIO;
        if (delay < 0) {
            // flight start is before animation start
            continue;
        }

        var origin = airportCoordinates[flight['ORIGIN']];
        var destination = airportCoordinates[flight['DESTINATION']];
        if (!origin || !destination) {
            continue;
        }

        var route = svg.append("path")
            .datum({type: "LineString", coordinates: [origin, destination]})
            .attr("class", "route")
            .attr("d", path);
        var routeFunction = delta(route.node());
        var firstPoint = routeFunction(0);

        var circle = new PIXI.Graphics();
        circle.beginFill(0x9966FF);
        circle.drawCircle(0, 0, 3);
        circle.endFill();
        circle.visible = false;
        circle.x = firstPoint[0];
        circle.y = firstPoint[1];
        circle.data = {};
        circle.data.delay = delay;
        circle.data.duration = duration;
        circle.data.route = routeFunction;
        app.stage.addChild(circle);
        console.log(flight);
        console.log(circle.data);
        points.push(circle);

        /*
        var plane = svg.append("circle")
            .attr("class", "plane")
            .attr("r", 2)
            .style("filter", "url(#glow)");

        plane
            .transition()
            .delay(delay)
            .transition()
            .duration(500)
            .style("opacity", 1)
            .transition()
            .duration(duration)
            .attrTween("transform", delta(route.node()))
            .transition()
            .duration(500)
            .remove();*/
    }

    ticker.start();
}

d3.queue()
    .defer(d3.json, "countries.topo.json")
    .defer(d3.json, "airports.topo.json")
    .defer(d3.csv, "flights.csv")
    .await(loaded);