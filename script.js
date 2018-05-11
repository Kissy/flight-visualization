var currentWidth = document.body.offsetWidth;
var width = 800;
var height = 400;

var svg = d3.select("body")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    /*.attr("preserveAspectRatio", "xMidYMid")
    .attr("viewBox", "0 0 " + width + " " + height)
    .attr("width", currentWidth)
    .attr("height", currentWidth * height / width)*/;

//Container for the gradients
var defs = svg.append("defs");

//Filter for the outside glow
var filter = defs.append("filter")
    .attr("id","glow");
filter.append("feGaussianBlur")
    .attr("stdDeviation","10")
    .attr("result","coloredBlur");
var feMerge = filter.append("feMerge");
feMerge.append("feMergeNode")
    .attr("in","coloredBlur");
feMerge.append("feMergeNode")
    .attr("in","SourceGraphic");

    var projection = d3.geoMercator()
        .scale(150)
        .translate([width / 2, height / 1.41]);

var path = d3.geoPath()
    .pointRadius(2)
    .projection(projection);


/*var url = "http://enjalot.github.io/wwsd/data/world/world-110m.geojson";
d3.json(url, function(err, geojson) {
    svg.append("path")
        .attr("d", path(geojson))
});*/

function delta(path) {
    var l = path.getTotalLength();
    return function(i) {
        return function(t) {
            var p = path.getPointAtLength(t * l);
            return "translate(" + p.x + "," + p.y + ")";
        }
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

    var dayDuration = 2000;
    var animationDuration = 31 * dayDuration;
    var dateInterpolation = d3.interpolateNumber(0, 31);
    var startDate = moment("2018-04-01");

    d3.select(".date")
        .transition()
        .duration(animationDuration)
        .on("start", function() {
            d3.active(this)
                .tween("text", function() {
                    var that = d3.select(this);
                    return function(t) {
                        var dayAdded = Math.round(dateInterpolation(t));
                        that.text(moment(startDate).add(dayAdded, 'days').format('DD/MM/YYYY'));
                    };
                })
                .ease(d3.easeLinear);
        });

    for (var i = 0; i < flights.length; i++) {
        var flight = flights[i];

        var flightStart = moment(flight['BEGIN_DATE']);
        var flightEnd = moment(flight['END_DATE']);
        var delay = flightStart.diff(startDate, 'seconds') * dayDuration / (24 * 60 * 60);
        var duration = flightEnd.diff(flightStart, 'seconds') * dayDuration / (24 * 60 * 60);
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
            .remove();
    }

    /*for (var i = 0; i < 1000; i++) {
        var start = Math.round(Math.random() * airportsFeatures.length);
        var end = Math.round(Math.random() * airportsFeatures.length);

        var route = svg.append("path")
            .datum({type: "LineString", coordinates: [airportsFeatures[start].geometry.coordinates, airportsFeatures[end].geometry.coordinates]})
            .attr("class", "route")
            .attr("d", path);
        var plane = svg.append("circle")
            .attr("class", "plane")
            .attr("r", 2)
            .style("filter", "url(#glow)");

        plane.transition()
            .delay(Math.round(Math.random() * 10000))
            .duration(5000)
            .attrTween("transform", delta(route.node()));
    }*/
}

d3.queue()
    .defer(d3.json, "countries.topo.json")
    .defer(d3.json, "airports.topo.json")
    .defer(d3.csv, "flights.csv")
    .await(loaded);