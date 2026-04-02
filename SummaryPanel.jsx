import { useEffect, useState } from "react";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    Tooltip,
    Legend
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import ChartDataLabels from "chartjs-plugin-datalabels";
import randomColor from "randomcolor";
import TileWMS from "ol/source/TileWMS";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useRef } from "react";



ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    Tooltip,
    Legend
);

const DEFAULT_FILTERS = [
    { key: "ownership", label: "OWNERSHIP" },
    { key: "category", label: "CATEGORY" },
    { key: "condition", label: "CONDITION" },
    { key: "material", label: "MATERIAL" },
    { key: "rowcls", label: "ROW" },
    { key: "drain_type", label: "DRAIN" },
];

const SLD_BY_FILTER = {
    ownership: "knp-ownership",
    category: "knp-category",
    condition: "knp-condition",
    material: "knp-material",
    rowcls: "knp-row",
    drain_type: "knp-drain",
};

const AMENITIES_TABLES = [
    "atm_bank",
    "bus_stop",
    "education",
    "graveyard",
    "hospital",
    "hotel",
    "park",
    "petrol_pump",
    "post_office",
    "religious"
];



const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { position: "bottom" },

        datalabels: {
            color: "#fff",
            font: { weight: "bold", size: 12 },
            anchor: "center",
            align: "center",
            formatter: (value, ctx) => {
                const data = ctx.chart.data.datasets[0].data;
                const total = data.reduce((a, b) => a + b, 0);
                const pct = ((value / total) * 100).toFixed(1);
                return pct < 3 ? "" : `${pct}%`;
            },
        },
    },
};



function SummaryPanel({ isOpen, onClose, filters = DEFAULT_FILTERS, onFilterChange, roadWmsSource,

    scanOpen,
    setScanOpen,
    scanFilters,
    setScanFilters,
    scanOptions,
    setScanOptions }) {
    const [activeFilter, setActiveFilter] = useState(null);

    const [metrics, setMetrics] = useState({ total_roads: "--", total_length_km: "--", });
    const [chartData, setChartData] = useState(null);
    const [zones, setZones] = useState([]);
    const [wards, setWards] = useState([]);
    const [legendColors, setLegendColors] = useState({});
    const [activeSection, setActiveSection] = useState("charts");
    const [amenitiesData, setAmenitiesData] = useState(null);








    const [selectedZone, setSelectedZone] = useState("");
    const [selectedWard, setSelectedWard] = useState("");
    const generateInsights = (metrics, chartData, activeFilter) => {
        if (!chartData) return [];

        const labels = chartData.labels || [];
        const values = chartData.datasets?.[0]?.data || [];

        if (!labels.length) return [];

        const total = values.reduce((a, b) => a + b, 0);

        let maxIndex = 0;
        let minIndex = 0;

        values.forEach((v, i) => {
            if (v > values[maxIndex]) maxIndex = i;
            if (v < values[minIndex]) minIndex = i;
        });

        const insights = [];


        insights.push({
            icon: "🏆",
            title: "Dominant Category",
            value: labels[maxIndex],
            description: `${values[maxIndex]} roads (${(
                (values[maxIndex] / total) *
                100
            ).toFixed(1)}%)`,
        });


        insights.push({
            icon: "📉",
            title: "Least Common",
            value: labels[minIndex],
            description: `${values[minIndex]} roads`,
        });


        insights.push({
            icon: "🛣",
            title: "Network Size",
            value: `${metrics.total_roads} Roads`,
            description: `${Number(metrics.total_length_km).toFixed(2)} km total`,
        });


        if (activeFilter === "condition") {

            let maintenanceCount = 0;
            let maintenanceLabels = [];

            labels.forEach((label, index) => {
                const name = label.toLowerCase();

                if (name.includes("poor") || name.includes("moderate")) {
                    maintenanceCount += values[index];
                    maintenanceLabels.push(label);
                }
            });

            if (maintenanceCount > 0) {
                insights.push({
                    icon: "🚧",
                    title: "Maintenance Needed",
                    value: maintenanceLabels.join(" + "),
                    description: `${maintenanceCount} roads require attention`,
                });
            }
        }


        if (activeFilter === "material") {
            insights.push({
                icon: "📊",
                title: "Material Dominance",
                value: labels[maxIndex],
                description: "Most used road material",
            });
        }

        return insights;
    };

    const insightsData = generateInsights(metrics, chartData, activeFilter);
    useEffect(() => {
        if (!isOpen) return;

        fetch("http://localhost:3000/api/filters/zones").then(r => r.json()).then(setZones);
    }, [isOpen]);


    useEffect(() => {
        if (!selectedZone) {
            setWards([]);
            setSelectedWard("");
            return;
        }

        fetch(`http://localhost:3000/api/filters/wards?zone=${selectedZone}`)
            .then(r => r.json())
            .then(setWards);
    }, [selectedZone]);


    useEffect(() => {
        if (!isOpen) return;

        const controller = new AbortController();

        const params = new URLSearchParams();
        if (selectedZone) params.append("zone", selectedZone);
        if (selectedWard) params.append("ward", selectedWard);

        Object.entries(scanFilters).forEach(([field, values]) => {

            if (!values?.length) return;

            params.append(field, values.join(","));

        });

        fetch(`http://localhost:3000/api/summary/roads?${params}`, {
            signal: controller.signal
        })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!data) return;
                setMetrics({
                    total_roads: data?.total_roads ?? 0,
                    total_length_km: data?.total_length_km ?? 0,
                });

            })
            .catch(err => {
                if (err.name !== "AbortError") {
                    console.error("Metrics fetch failed", err);
                }
            });

        return () => controller.abort();
    }, [isOpen, selectedZone, selectedWard, scanFilters]);





    // const handleFilterClick = (key) => {
    //     setActiveFilter(key);
    // };

    const handleFilterClick = (key) => {
        setActiveFilter(key);

        if (!roadWmsSource) return;
        console.log("SLD before:", roadWmsSource.getParams().STYLES);

        const sldName = SLD_BY_FILTER[key];
        if (!sldName) return;

        roadWmsSource.updateParams({
            STYLES: sldName,
            _t: Date.now(), // force WMS refresh
        });
    };



    useEffect(() => {
        if (isOpen) return; // only run when panel CLOSES
        if (!roadWmsSource) return;

        // Reset SLD back to default
        roadWmsSource.updateParams({
            STYLES: "generic",
            _t: Date.now(), // force refresh
        });

    }, [isOpen, roadWmsSource]);



    useEffect(() => {
        if (!isOpen || !activeFilter) return;

        const controller = new AbortController();

        const run = async () => {
            try {
                const params = new URLSearchParams({ field: activeFilter });
                if (selectedZone) params.append("zone", selectedZone);
                if (selectedWard) params.append("ward", selectedWard);
                Object.entries(scanFilters).forEach(([field, values]) => {
                    if (!values?.length) return;
                    params.append(field, values.join(","));
                });
                const res = await fetch(
                    `http://localhost:3000/api/summary/group?${params}`,
                    { signal: controller.signal }
                );

                if (!res.ok) return;

                const rows = await res.json();
                if (!rows?.length) {
                    setChartData({
                        labels: ["No data"],
                        datasets: [{
                            label: activeFilter.toUpperCase(),
                            data: [0],
                            backgroundColor: ["rgba(200,200,200,0.4)"],
                            borderWidth: 1
                        }]
                    });
                    return;
                }



                const labels = rows.map(r => r.name);
                const values = rows.map(r => r.count);

                const colors = labels.map(
                    label => legendColors[label] || "#999999"
                );

                setChartData({
                    labels,
                    datasets: [{
                        label: activeFilter.toUpperCase(),
                        data: values,
                        backgroundColor: colors,
                        borderWidth: 1
                    }]
                });


            } catch (err) {
                if (err.name !== "AbortError") {
                    console.error("Chart fetch failed", err);
                }
            }
        };

        run();
        return () => controller.abort();

    }, [isOpen, activeFilter, selectedZone, selectedWard, legendColors, scanFilters]);


    useEffect(() => {
        const legendDiv = document.getElementById("legend1");
        if (!legendDiv) return;

        // Panel closed → legend hidden
        if (!isOpen) {
            legendDiv.style.display = "none";
            legendDiv.innerHTML = "";

            // reset SLD also
            if (roadWmsSource) {
                roadWmsSource.updateParams({
                    STYLES: "generic",
                    _t: Date.now(),
                });
            }

            return;
        }

        // Panel open but no filter yet → legend hidden
        if (!activeFilter) {
            legendDiv.style.display = "none";
            legendDiv.innerHTML = "";
            return;
        }

        //  Panel open + filter active → show legend
        const style = SLD_BY_FILTER[activeFilter];
        if (!style) return;

        const legendURL =
            `http://localhost:8080/geoserver/india/wms` +
            `?SERVICE=WMS` +
            `&REQUEST=GetLegendGraphic` +
            `&VERSION=1.0.0` +
            `&FORMAT=image/png` +
            `&LAYER=india:kanpur_road_net` +
            `&STYLE=${style}` +
            `&LEGEND_OPTIONS=forceLabels:on;fontSize:11` +
            `&_=${Date.now()}`;

        legendDiv.style.display = "block";
        legendDiv.innerHTML = `<img src="${legendURL}" />`;
    }, [isOpen, activeFilter, roadWmsSource]);



    async function fetchLegendColors(styleName) {
        if (!styleName) return {};

        const url =
            "http://localhost:8080/geoserver/india/wms" +
            "?SERVICE=WMS" +
            "&VERSION=1.1.1" +
            "&REQUEST=GetLegendGraphic" +
            "&FORMAT=application/json" +
            "&LAYER=india:kanpur_road_net" +
            `&STYLE=${styleName}` +
            "&LEGEND_OPTIONS=forceLabels:on";

        const res = await fetch(url);
        const text = await res.text();


        if (text.trim().startsWith("<")) {
            console.error("Legend JSON error:", text);
            return {};
        }

        const legend = JSON.parse(text);

        const colorMap = {};
        legend.Legend[0].rules.forEach(rule => {
            colorMap[rule.name] =
                rule.symbolizers[0].Polygon?.fill ||
                rule.symbolizers[0].Line?.stroke ||
                rule.symbolizers[0].Point?.fill;
        });

        return colorMap;
    }


    useEffect(() => {
        let cancelled = false;

        async function loadColors() {
            if (!activeFilter) {
                setLegendColors({});
                return;
            }

            const styleName = SLD_BY_FILTER[activeFilter];
            const colors = await fetchLegendColors(styleName);

            if (!cancelled) {
                setLegendColors(colors);
            }
        }

        loadColors();

        return () => {
            cancelled = true;
        };
    }, [activeFilter]);


    // useEffect(() => {
    //     if (isOpen) return;

    //     setActiveFilter(null);
    //     setSelectedZone("");
    //     setSelectedWard("");
    //     setWards([]);
    //     setChartData(null);
    //     setMetrics({
    //         total_roads: "--",
    //         total_length_km: "--",
    //     });
    //     onFilterChange?.(null);
    //     setActiveSection("charts");


    // }, [isOpen]);

    useEffect(() => {

        if (isOpen) return;

        // reset chart filters
        setActiveFilter(null);

        // reset dropdown filters
        setSelectedZone("");
        setSelectedWard("");
        setWards([]);

        // reset scan filters
        setScanFilters({});

        // reset charts
        setChartData(null);

        // reset metrics
        setMetrics({
            total_roads: "--",
            total_length_km: "--",
        });

        // reset section
        setActiveSection("charts");

        // reset legend
        const legendDiv = document.getElementById("legend1");
        if (legendDiv) {
            legendDiv.innerHTML = "";
            legendDiv.style.display = "none";
        }

        onFilterChange?.(null);

    }, [isOpen]);


    useEffect(() => {
        if (!selectedZone) {
            setSelectedWard("");
            return;
        }

        setSelectedWard("");
    }, [selectedZone]);


    useEffect(() => {
        if (!roadWmsSource) return;

        // If panel closed → remove CQL
        if (!isOpen) {
            roadWmsSource.updateParams({
                CQL_FILTER: null,
                _t: Date.now(),
            });
            return;
        }

        // Build CQL dynamically
        let filters = [];

        if (selectedZone) {
            filters.push(`zone_no = '${selectedZone}'`);
        }

        if (selectedWard) {
            filters.push(`ward_no = '${selectedWard}'`);
        }

        Object.entries(scanFilters).forEach(([field, values]) => {

            if (!values.length) return;

            const clause = values
                .map(v => `${field} = '${v}'`)
                .join(" OR ");

            filters.push(`(${clause})`);

        });

        const cql = filters.length ? filters.join(" AND ") : null;

        roadWmsSource.updateParams({
            CQL_FILTER: cql,
            _t: Date.now(),
        });

    }, [isOpen, selectedZone, selectedWard, scanFilters, roadWmsSource]);

    useEffect(() => {
        if (!isOpen) return;
        if (activeSection !== "amenities") return;

        const controller = new AbortController();

        const fetchAmenities = async () => {
            try {
                const res = await fetch(
                    "http://localhost:3000/api/amenities-count",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            tables: AMENITIES_TABLES,
                            zone: selectedZone || null,
                            ward: selectedWard || null
                        }),
                        signal: controller.signal
                    }
                );

                if (!res.ok) return;

                const data = await res.json();
                setAmenitiesData(data);

            } catch (err) {
                if (err.name !== "AbortError") {
                    console.error("Amenities fetch failed", err);
                }
            }
        };

        fetchAmenities();

        return () => controller.abort();

    }, [isOpen, activeSection, selectedZone, selectedWard]);


    const formatAmenityName = (name) => {
        return name
            .replace(/_/g, " ")
            .toUpperCase();
    };


    useEffect(() => {

        if (!scanOpen) return;

        filters.forEach(async (f) => {

            if (scanOptions[f.key]) return;

            const res = await fetch(
                `http://localhost:3000/api/filters/distinct?field=${f.key}`
            );

            const data = await res.json();

            setScanOptions(prev => ({
                ...prev,
                [f.key]: data
            }));

        });

    }, [scanOpen]);

//return block for UI

    return (
        <div className={`summary-panel ${isOpen ? "open" : ""}`}>


            <div className="summary-header">
                <span>ROAD NET SUMMARY</span>
                <button className="summary-close" onClick={onClose}>×</button>
            </div>

            <div className="summary-filters-row">

                <select value={selectedZone} onChange={(e) => setSelectedZone(e.target.value)}>
                    <option value="">All Zones</option>
                    {zones.map(z => (
                        <option key={z.zone_no} value={z.zone_no}>
                            Zone {z.zone_no}
                        </option>
                    ))}
                </select>

                <select value={selectedWard} onChange={(e) => setSelectedWard(e.target.value)} disabled={!selectedZone}>
                    <option value="">All Wards</option>
                    {wards.map(w => (
                        <option key={w.ward_no} value={w.ward_no}>
                            Ward {w.ward_no}
                        </option>
                    ))}
                </select>

            </div>


            <div className="summary-metrics">
                <div className="metric-card">
                    <div className="metric-value">
                        {metrics.total_roads}
                    </div>
                    <div className="metric-label">
                        Total Roads
                    </div>
                </div>

                <div className="metric-card">
                    <div className="metric-value">
                        {Number(metrics.total_length_km).toFixed(2)}
                    </div>
                    <div className="metric-label">
                        Total Length (km)
                    </div>
                </div>
            </div>


            <div className="summary-section-toggle">
                <button
                    className={`scan-toggle-btn ${scanOpen ? "active" : ""}`}
                    onClick={() => setScanOpen(v => !v)}
                >
                    {scanOpen ? "◀" : "▶"}
                </button>

                <button
                    className={`tab-btn ${activeSection === "charts" ? "active" : ""}`}
                    onClick={() => setActiveSection("charts")}
                >
                    CHARTS
                </button>

                <button
                    className={`tab-btn ${activeSection === "amenities" ? "active" : ""}`}
                    onClick={() => setActiveSection("amenities")}
                >
                    AMENITIES
                </button>



            </div>


            {activeSection === "charts" && (
                <div className="summary-filter-grid">

                    {filters.map((f) => (
                        <button
                            key={f.key}
                            className={`summary-filter-btn ${activeFilter === f.key ? "active" : ""}`}
                            onClick={() => handleFilterClick(f.key)}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            )}



            {activeSection === "charts" && chartData && (

                <div className="summary-body">

                    <div style={{ height: 260 }}>
                        <Bar
                            data={chartData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                            }}
                        />
                    </div>

                    <div style={{ height: 260, marginTop: 20 }}>
                        <Doughnut
                            data={chartData}
                            options={doughnutOptions}
                            plugins={[ChartDataLabels]}
                        />
                    </div>

                    <div className="insights-grid">
                        {insightsData.map((insight, i) => (
                            <div key={i} className="insight-card">
                                <div className="insight-icon">{insight.icon}</div>

                                <div className="insight-content">
                                    <div className="insight-title">
                                        {insight.title}
                                    </div>

                                    <div className="insight-value">
                                        {insight.value}
                                    </div>

                                    <div className="insight-desc">
                                        {insight.description}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                </div>


            )}



            {activeSection === "amenities" && (<div className="amenities-grid">
                {amenitiesData?.map((item) => (
                    <div key={item.name} className="amenity-card">
                        <div className="amenity-name">
                            <span className="amenity-dot"></span>
                            {formatAmenityName(item.name)}
                        </div>
                        <div className="amenity-count">{item.count}</div>
                    </div>
                ))}
            </div>
            )}



        </div>
    );
}

export default SummaryPanel;
