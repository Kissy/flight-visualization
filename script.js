var currentWidth = document.body.clientWidth;
var currentHeight = document.body.clientHeight;
var START_DATE = moment("2018-04-01");
var END_DATE = moment("2018-05-01");
// var START_DATE = moment();
// var END_DATE = moment().add(1, 'days');
var ANIMATION_SPEED = 60 * 60 * 24 / 2;
// var ANIMATION_SPEED = 10000;
// var FADE_IN_TIME = 10 * ANIMATION_SPEED;
var FADE_IN_TIME = 1000;

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
    transparent: true,
    antialiasing: true
});
app.view.className = 'flights';
document.body.appendChild(app.view);

var points = [];
var ticker = new PIXI.ticker.Ticker();

var animationTime = 0;
ticker.add(function () {
    if (moment(START_DATE).add(animationTime, 'seconds').isAfter(END_DATE)) {
        animationTime = 0;
    }

    animationTime += (ticker.elapsedMS / 1000) * ANIMATION_SPEED;
    d3.select(".date").text(moment(START_DATE).add(animationTime, 'seconds').format('YYYY-MM-DD HH:mm:ss'));

    for (var i = points.length - 1; i >= 0; i--) {
        var point = points[i];
        
        if (animationTime > point.data.end + FADE_IN_TIME) {
            point.visible = false;
        } else if (animationTime > point.data.end) {
            point.visible = true;
            point.alpha = d3.easeSin((animationTime - point.data.end + FADE_IN_TIME) / FADE_IN_TIME);
        } else if (animationTime >= point.data.delay) {
			if (!point.data.routeFunction) {	
				point.data.routeFunction = delta(point.data.route.node());
			}
        
            var newPosition = point.data.routeFunction((animationTime - point.data.delay) / point.data.duration);
            point.x = newPosition[0];
            point.y = newPosition[1];
            point.visible = true;
            point.alpha = 1;
        } else if (animationTime > point.data.delay - FADE_IN_TIME) {
            point.visible = true;
            point.alpha = d3.easeSin((animationTime - (point.data.delay - FADE_IN_TIME)) / FADE_IN_TIME);
        } else {
            point.visible = false;
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

        var route = svg.append("path")
            .datum({type: "LineString", coordinates: [origin, destination]})
            .attr("class", "route")
            .attr("d", path);

        var circle = new PIXI.Graphics();
        circle.beginFill(0x6cb0e0);
        circle.drawCircle(0, 0, 2);
        circle.endFill();
        circle.visible = false;
        circle.alpha = 0;
        circle.data = {};
        circle.data.delay = delay;
        circle.data.duration = duration;
        circle.data.end = delay + duration;
        circle.data.route = route;
        app.stage.addChild(circle);
        points.push(circle);
    }

    ticker.start();
}

d3.queue()
    .defer(d3.json, "countries.topo.json")
    .defer(d3.csv, "airports.csv")
    .defer(d3.csv, "flights.csv")
    .await(loaded);