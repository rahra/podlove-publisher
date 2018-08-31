jQuery(document).ready(function ($) {
	var totalsRawData;

	var reduceAddFun = function (p, v) {

		p.downloads += v.downloads;

		p.episode_id = v.episode_id;
		p.date = v.date;

		return p;
	};
	var reduceSubFun = function (p, v) {
		p.downloads -= v.downloads;
		return p;
	};
	var reduceBaseFun = function () {
		return {
			downloads: 0,
			episode_id: 0,
			date: 0,
		};
	};

	function render_episode_performance_chart() {
		var chart_width = $("#total-chart").closest(".wrap").width();
		var xfilter = crossfilter(totalsRawData);
		var all = xfilter.groupAll().reduce(reduceAddFun, reduceSubFun, reduceBaseFun);
		var total_downloads = all.value().downloads;

		// dimension: "hours since release"
		var dateDimension = xfilter.dimension(function (d) {
			// return d.date;
			return d3.timeDay(d.date);
		});

		var episodeDimension = xfilter.dimension(function (d) {
			return d.episode_id;
		});
		var episodeGroup = episodeDimension.group().reduce(function (p, v) {
			p.downloads += v.downloads;
			p.episode_id = v.episode_id;
			return p;
		}, null, function () {
			return {
				downloads: 0,
				episode_id: 0,
			};
		})

		// threshold to make it to top episodes: more than 5% of total downloads in time segment
		var top_episodes = episodeGroup.all().reduce(function (acc, cur) {

			if (cur.value.downloads > total_downloads * 0.05) {
				acc.push(cur);
			}

			return acc;
		}, []);

		var top_episode_ids = _.pluck(top_episodes, "key");

		// group: downloads
		// var downloadsGroup = dateDimension.group().reduce(reduceAddFun, reduceSubFun, reduceBaseFun);

		var downloadsWithoutTopGroup = dateDimension.group().reduce(function (p, v) {
			if (!_.contains(top_episode_ids, v.episode_id)) {
				return reduceAddFun(p, v);
			} else {
				return p;
			}
		}, function (p, v) {
			if (!_.contains(top_episode_ids, v.episode_id)) {
				return reduceSubFun(p, v);
			} else {
				return p;
			}
		}, reduceBaseFun);

		var filter_dimension_by_episode_id = function (dim, episode_id) {
			return dim.group().reduce(function (p, v) {
				if (v.episode_id == episode_id) {
					return reduceAddFun(p, v);
				} else {
					return p;
				}
			}, function (p, v) {
				if (v.episode_id == episode_id) {
					return reduceSubFun(p, v);
				} else {
					return p;
				}
			}, reduceBaseFun);
		}

		var top_episode_groups = [];

		for (var index in top_episode_ids) {
			top_episode_groups[top_episode_ids[index]] = (filter_dimension_by_episode_id(dateDimension, top_episode_ids[index]));
		}

		/**
		 * Charts
		 */
		var daysAgo = function (days) {
			return new Date(new Date().setDate(new Date().getDate() - days));
		};

		var titleDateFormat = d3.timeFormat("%Y-%m-%d");

		var downloadsChart = dc.barChart("#total-chart")
			.width(chart_width)
			.height(200)
			.dimension(dateDimension)
			.group(downloadsWithoutTopGroup, "Other Episodes")
			.x(d3.scaleTime().domain([daysAgo(28), new Date()]))
			.xUnits(d3.timeDays)
			.brushOn(false)
			.renderTitle(true)
			.elasticY(true)
			.yAxisLabel("Downloads")
			.valueAccessor(function (v) {
				return v.value.downloads;
			})
			.title(function (d) {
				return [
					titleDateFormat(d.key),
					"Downloads: " + d.value.downloads
				].join("\n");
			})
			.renderHorizontalGridLines(true);

		// responsive legend position
		var legendWidth = 300;
		if (chart_width > 650) {
			var legendX = chart_width - legendWidth;

			jQuery("#total-chart").height("200px")
			downloadsChart.height(200);
			downloadsChart.legend(dc.legend().horizontal(false).x(legendX).y(10).autoItemWidth(true));
			downloadsChart.margins().bottom = 30;
			downloadsChart.margins().right = legendWidth + 5;
		} else {
			var legendX = chart_width - legendWidth;

			jQuery("#total-chart").height("370px")
			downloadsChart.height(370);
			downloadsChart.legend(dc.legend().horizontal(false).x(30).y(170).autoItemWidth(true));
			downloadsChart.margins().bottom = 30 + 200;
		}

		for (var index in top_episode_groups) {
			downloadsChart.stack(top_episode_groups[index], podlove_episode_names[index]);
		}

		downloadsChart.yAxis().tickFormat(PODLOVE.Analytics.formatThousands);
		downloadsChart.xAxis().tickFormat(d3.timeFormat("%d %b"));

		// responsive tick label amounts
		if (chart_width < 550) {
			downloadsChart.xAxis().ticks(d3.timeDay, 5);
		} else if (chart_width < 635) {
			downloadsChart.xAxis().ticks(d3.timeDay, 4);
		} else if (chart_width < 780) {
			downloadsChart.xAxis().ticks(d3.timeDay, 3);
		} else {
			downloadsChart.xAxis().ticks(d3.timeDay, 2);
		}

		downloadsChart.render();
	}

	function load_episode_performance_chart() {

		if (totalsRawData) {
			render_episode_performance_chart();
			$(window).on('resize', render_episode_performance_chart);
		} else {
			$.when(
				$.ajax(ajaxurl + "?action=podlove-analytics-total-downloads-per-day")
			).done(function (csvTotals) {

				var csvMapper = function (d) {
					var parsed_date = new Date(+d.date * 1000);

					return {
						date: parsed_date,
						downloads: +d.downloads,
						episode_id: +d.episode_id
					};
				};

				totalsRawData = d3.csvParse(csvTotals, csvMapper);

				render_episode_performance_chart();
				$(window).on('resize', render_episode_performance_chart);
			});
		}

	}

	if ($("#total-chart").length) {
		load_episode_performance_chart();
	}

	var chartColor = '#69B3FF';

	const renderAssetsChart = function (data) {
		let xf = crossfilter(data)
		var dimension = xf.dimension((d) => d.asset);
		var group = dimension.group().reduceSum((d) => d.downloads);
		const total = xf.groupAll().reduceSum((d) => d.downloads).value();

		let chart = dc.rowChart('#analytics-chart-global-assets')
			.margins({
				top: 0,
				left: 40,
				right: 10,
				bottom: 25
			})
			.elasticX(true)
			.dimension(dimension) // set dimension
			.group(group) // set group
			.valueAccessor(function (v) {
				if (v.value) {
					return v.value;
				} else {
					return 0;
				}
			})
			.ordering((v) => -v.value)
			.colors(chartColor)
			.on('renderlet', (chart) => PODLOVE.Analytics.addPercentageLabels(chart, total))
		// .on('renderlet', addResetFilter);

		chart.xAxis().tickFormat(PODLOVE.Analytics.formatThousands);
		chart.render();
	}

	const renderSourcesChart = function (data) {
		let xf = crossfilter(data)
		var dimension = xf.dimension((d) => d.source);
		var group = dimension.group().reduceSum((d) => d.downloads);
		const total = xf.groupAll().reduceSum((d) => d.downloads).value();

		let chart = dc.rowChart('#analytics-chart-global-sources')
			.margins({
				top: 0,
				left: 40,
				right: 10,
				bottom: 25
			})
			.elasticX(true)
			.dimension(dimension) // set dimension
			.group(group) // set group
			.valueAccessor(function (v) {
				if (v.value) {
					return v.value;
				} else {
					return 0;
				}
			})
			.ordering((v) => -v.value)
			.othersGrouper(function (data) {
				return data; // no 'others' group
			})
			.colors(chartColor)
			.on('renderlet', (chart) => PODLOVE.Analytics.addPercentageLabels(chart, total))
		// .on('renderlet', addResetFilter);

		chart.xAxis().tickFormat(PODLOVE.Analytics.formatThousands);
		chart.render();
	}

	const renderClientsChart = function (data) {
		let xf = crossfilter(data)
		var dimension = xf.dimension((d) => d.client_name);
		var group = dimension.group().reduceSum((d) => d.downloads);
		const total = xf.groupAll().reduceSum((d) => d.downloads).value();

		let chart = dc.rowChart('#analytics-chart-global-clients')
			.margins({
				top: 0,
				left: 40,
				right: 10,
				bottom: 25
			})
			.elasticX(true)
			.dimension(dimension) // set dimension
			.group(group) // set group
			.valueAccessor(function (v) {
				if (v.value) {
					return v.value;
				} else {
					return 0;
				}
			})
			.ordering((v) => -v.value)
			.othersGrouper(function (data) {
				return data; // no 'others' group
			})
			.colors(chartColor)
			.cap(10)
			.on('renderlet', (chart) => PODLOVE.Analytics.addPercentageLabels(chart, total))
		// .on('renderlet', addResetFilter);

		chart.xAxis().tickFormat(PODLOVE.Analytics.formatThousands);
		chart.render();
	}

	const renderSystemsChart = function (data) {
		let xf = crossfilter(data)
		var dimension = xf.dimension((d) => d.os_name);
		var group = dimension.group().reduceSum((d) => d.downloads);
		const total = xf.groupAll().reduceSum((d) => d.downloads).value();

		let chart = dc.rowChart('#analytics-chart-global-systems')
			.margins({
				top: 0,
				left: 40,
				right: 10,
				bottom: 25
			})
			.elasticX(true)
			.dimension(dimension) // set dimension
			.group(group) // set group
			.valueAccessor(function (v) {
				if (v.value) {
					return v.value;
				} else {
					return 0;
				}
			})
			.ordering((v) => -v.value)
			.othersGrouper(function (data) {
				return data; // no 'others' group
			})
			.colors(chartColor)
			.cap(10)
			.on('renderlet', (chart) => PODLOVE.Analytics.addPercentageLabels(chart, total))
		// .on('renderlet', addResetFilter);

		chart.xAxis().tickFormat(PODLOVE.Analytics.formatThousands);
		chart.render();
	}

	if ($("#analytics-chart-global-assets").length) {
		$.when(
			$.ajax(ajaxurl + '?action=podlove-analytics-global-assets')
		).done(function (csvAssets) {

			const csvMapper = function (d) {
				return {
					downloads: +d.downloads,
					asset: d.asset ? d.asset : 'Unknown'
				}
			}

			let assetData = d3.csvParse(csvAssets, csvMapper);

			renderAssetsChart(assetData);
		});
	}

	if ($("#analytics-chart-global-clients").length) {
		$.when(
			$.ajax(ajaxurl + '?action=podlove-analytics-global-clients')
		).done(function (csv) {

			const csvMapper = function (d) {
				return {
					downloads: +d.downloads,
					client_name: d.client_name ? d.client_name : 'Unknown'
				}
			}

			let assetData = d3.csvParse(csv, csvMapper);

			renderClientsChart(assetData);
		});
	}

	if ($("#analytics-chart-global-systems").length) {
		$.when(
			$.ajax(ajaxurl + '?action=podlove-analytics-global-systems')
		).done(function (csv) {

			const csvMapper = function (d) {
				return {
					downloads: +d.downloads,
					os_name: d.os_name ? d.os_name : 'Unknown'
				}
			}

			let assetData = d3.csvParse(csv, csvMapper);

			renderSystemsChart(assetData);
		});
	}

	if ($("#analytics-chart-global-sources").length) {
		$.when(
			$.ajax(ajaxurl + '?action=podlove-analytics-global-sources')
		).done(function (csv) {

			const csvMapper = function (d) {
				return {
					downloads: +d.downloads,
					source: d.source ? d.source : 'Unknown'
				}
			}

			let assetData = d3.csvParse(csv, csvMapper);

			renderSourcesChart(assetData);
		});
	}
});
