var currentWidth = document.body.clientWidth;
var currentHeight = document.body.clientHeight;
var START_DATE = moment("2018-04-01").add(9, 'hours');
var ANIMATION_SPEED = 60 * 60 * 24 / 2;
var FADE_IN_SPEED = 0.2;

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
ticker.add(function () {
    realTime += ticker.elapsedMS;
    animationTime += (ticker.elapsedMS / 1000) * ANIMATION_SPEED;
    d3.select(".date").text(moment(START_DATE).add(animationTime, 'seconds').format('YYYY-MM-DD HH:mm'));

    for (var i = points.length - 1; i >= 0; i--) {
        var point = points[i];
        if (point.visible) {
            if (animationTime > point.data.delay + point.data.duration) {
                if (point.alpha > 0) {
                    point.alpha -= FADE_IN_SPEED;
                } else {
                    point.visible = false;
                    points.splice(i, 1);
                }
            } else {
                if (point.alpha < 1) {
                    point.alpha += FADE_IN_SPEED;
                }
                var currentPoint = (animationTime - point.data.delay) / point.data.duration;
                var newPosition = point.data.route(currentPoint);
                point.x = newPosition[0];
                point.y = newPosition[1];
            }
        } else if (animationTime >= point.data.delay) {
            point.visible = true;
        }
    }
});

function delta(path) {
    var l = path.getTotalLength();
    return function (t) {
        var p = path.getPointAtLength(d3.easeSin(t) * l);
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

    var airportCoordinates = {};
    for (var i = 0; i < airports.length; i++) {
        var airport = airports[i];
        airportCoordinates[airport['IATA']] = {
            coordinates: [airport['LONGITUDE'], airport['LATITUDE']],
            timezone: airport['TIMEZONE']
        };
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

    for (var i = 0; i < flights.length; i++) {
        var flight = flights[i];

        var originAirport = airportCoordinates[flight['ORIGIN']];
        var destinationAirport = airportCoordinates[flight['DESTINATION']];
        if (!originAirport || !destinationAirport) {
            continue;
        }

        var origin = originAirport.coordinates;
        var destination = destinationAirport.coordinates;
        var flightStart = moment(flight['BEGIN_DATE']).subtract(originAirport.timezone, 'hours');
        var flightEnd = moment(flight['END_DATE']).subtract(destinationAirport.timezone, 'hours');
        var delay = flightStart.diff(START_DATE, 'seconds');
        var duration = flightEnd.diff(flightStart, 'seconds');
        if (delay < 0) {
            // flight start is before animation start
            continue;
        }

        var route = svg.append("path")
            .datum({type: "LineString", coordinates: [origin, destination]})
            .attr("class", "route")
            .attr("d", path);
        var routeFunction = delta(route.node());
        var firstPoint = routeFunction(0);

        var circle = new PIXI.Graphics();
        circle.beginFill(0x6cb0e0);
        circle.drawCircle(0, 0, 3);
        circle.endFill();
        circle.visible = false;
        circle.alpha = 0;
        circle.x = firstPoint[0];
        circle.y = firstPoint[1];
        circle.data = {};
        circle.data.delay = delay;
        circle.data.duration = duration;
        circle.data.route = routeFunction;
        app.stage.addChild(circle);
        points.push(circle);
    }

    ticker.start();
}

d3.queue()
    .defer(d3.json, "countries.topo.json")
    //.defer(d3.json, "airports.topo.json")
    .defer(d3.csv, "airports.csv")
    .defer(d3.csv, "flights.csv")
    .await(loaded);