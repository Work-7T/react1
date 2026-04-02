import { useEffect, useRef, useState } from "react";
import { get as getProjection } from "ol/proj";
import { bbox as bboxStrategy } from "ol/loadingstrategy";
import { isEmpty as isExtentEmpty } from "ol/extent";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";
import TileWMS from "ol/source/TileWMS";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import Style from "ol/style/Style";
import Stroke from "ol/style/Stroke";
import Fill from "ol/style/Fill";
import { ScaleLine } from "ol/control";
import SummaryPanel from "./SummaryPanel";

import BaseLayerSwitcher from "./BaseLayerSwitcher";
import "ol/ol.css";



function MapView({ mapApiRef }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const baseLayersRef = useRef({});
  const zoneLayersRef = useRef({});
  const zoneExtentsRef = useRef({});
  const subLayersRef = useRef({});

  const [activeBase, setActiveBase] = useState("OSM");
  const [activeZone, setActiveZone] = useState(null);
  const [jumperOpen, setJumperOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [selectedSubLayers, setSelectedSubLayers] = useState({});
  const [scanFilters, setScanFilters] = useState({});
  const [scanOptions, setScanOptions] = useState({});
  const [scanOpen, setScanOpen] = useState(false);


  const [tempScanFilters, setTempScanFilters] = useState({});
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [lengthOpen, setLengthOpen] = useState(false);
const [lengthRange, setLengthRange] = useState([0, 10]); // min, max
const [lengthStats, setLengthStats] = useState({
  total_roads: 0,
  total_length_km: 0
});
  const wardBoundaryStyle = new Style({
    stroke: new Stroke({
      color: "#000000",   // dark blue-gray
      width: 2.5,
      lineDash: [6, 4],   // dashed = clear difference from zone
    }),
    fill: new Fill({
      color: "rgba(0, 0, 0, 0)",
    }),
  });





  const ZONE_LAYERS = {
    kanpurZone: {
      layerName: "kanpur_nn:kanpur_zone__boundary",
      style: new Style({
        stroke: new Stroke({
          color: "#000",
          width: 3
        }),
        fill: new Fill({
          color: "rgba(255, 255, 255, 0.15)"
        })
      }),
    },

    lucknowZone: {
      layerName: "india:lucknow_zone_boundary",
      style: new Style({
        stroke: new Stroke({
          color: "#000",
          width: 3
        }),
        fill: new Fill({
          color: "rgba(255, 255, 255, 0.15)"
        })
      }),
    },
  };
  const kanpurWardLayer = new VectorLayer({
    visible: false,
    style: wardBoundaryStyle,
    source: new VectorSource({
      url:
        "http://localhost:8080/geoserver/india/ows?" +
        "service=WFS&version=1.0.0&request=GetFeature&" +
        "typeName=india:kanpur_ward_boundary&" +
        "outputFormat=application/json",
      format: new GeoJSON(),
    }),
  });
  const kanpurRoadSourceRef = useRef(null);
  const kanpurRoadLayerRef = useRef(null);

  if (!kanpurRoadSourceRef.current) {
    kanpurRoadSourceRef.current = new TileWMS({
      url: "http://localhost:8080/geoserver/india/wms",
      params: {
        LAYERS: "india:kanpur_road_net",
        VERSION: "1.3.0",
        STYLES: "generic",
      },
      crossOrigin: "anonymous",
      serverType: "geoserver",
      tiled: false,
    });

    kanpurRoadLayerRef.current = new TileLayer({
      source: kanpurRoadSourceRef.current,
      visible: false,
    });
  }


  const lucknowWardLayer = new VectorLayer({
    visible: false,
    style: wardBoundaryStyle,
    source: new VectorSource({
      url:
        "http://localhost:8080/geoserver/india/ows?" +
        "service=WFS&version=1.0.0&request=GetFeature&" +
        "typeName=india:lucknow_ward_boundary&" +
        "outputFormat=application/json",
      format: new GeoJSON(),
    }),
  });


  const lucknowRoadLayer = new TileLayer({
    visible: false,
    source: new TileWMS({
      url: "http://localhost:8080/geoserver/india/wms",
      crossOrigin: "anonymous",
      params: {
        LAYERS: "india:lucknow_roadnet",
        TILED: true,
        VERSION: "1.3.0",
      },
      serverType: "geoserver",
    }),
  });
  const subLayerMapping = {
    kanpurZone: {
      ward: kanpurWardLayer,
      road: kanpurRoadLayerRef.current,
      amenities: null,
    },
    lucknowZone: {
      ward: lucknowWardLayer,
      road: lucknowRoadLayer,
      amenities: null,
    },

  };
  // useEffect(() => {
  //   if (activeZone !== "kanpurZone") {
  //     setSummaryOpen(false);
  //   }
  // }, [activeZone]);


  useEffect(() => {
    if (mapInstance.current) return;


    const osmLayer = new TileLayer({
      source: new OSM(),
      visible: true,
    });

    const satelliteLayer = new TileLayer({
      source: new XYZ({
        url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      }),
      visible: false,
    });

    baseLayersRef.current = {
      OSM: osmLayer,
      SATELLITE: satelliteLayer,
    };


    const scaleLineControl = new ScaleLine({
      units: "metric",       // meters / kilometers
      bar: true,             // bar style (professional)
      steps: 4,
      text: true,
      minWidth: 120,
    });


    mapInstance.current = new Map({
      target: mapRef.current,
      layers: [osmLayer, satelliteLayer, kanpurRoadLayerRef.current, lucknowRoadLayer],
      view: new View({
        projection: getProjection("EPSG:4326"),
        center: [78.9629, 20.5937],
        zoom: 5,
      }),
      controls: [
        scaleLineControl,
      ],
    });


    lucknowRoadLayer.setVisible(false);





    const jumpToCoordinate = () => {
      const lat = parseFloat(document.getElementById("lat-input")?.value);
      const lon = parseFloat(document.getElementById("lon-input")?.value);

      if (isNaN(lat) || isNaN(lon)) {
        alert("Enter valid latitude and longitude");
        return;
      }

      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        alert("Coordinates out of range");
        return;
      }

      mapInstance.current.getView().animate({
        center: [lon, lat],
        zoom: 15,
        duration: 800,
      });
    };

    document.getElementById("jump-btn")?.addEventListener("click", jumpToCoordinate);




    mapInstance.current.on("pointermove", (evt) => {
      if (!evt.coordinate) return;

      const [lon, lat] = evt.coordinate;

      const latFixed = lat.toFixed(5);
      const lonFixed = lon.toFixed(5);

      const el = document.getElementById("latlon-text");
      if (el) {
        el.innerHTML = `Lat: ${latFixed}, Lon: ${lonFixed}`;
      }
    });




    Object.entries(ZONE_LAYERS).forEach(([key, cfg]) => {
      const vectorLayer = new VectorLayer({
        visible: false,
        style: cfg.style,
        source: new VectorSource({
          format: new GeoJSON(),
          url:
            `http://localhost:8080/geoserver/wfs?` +
            `service=WFS&version=1.1.0&request=GetFeature&` +
            `typeName=${cfg.layerName}&` +
            `outputFormat=application/json&` +
            `srsname=EPSG:4326`,
        }),
      });


      zoneLayersRef.current[key] = vectorLayer;
      zoneExtentsRef.current[key] = cfg.extent;

      mapInstance.current.addLayer(vectorLayer);
    });

    // mapApiRef.current = {
    //   toggleZone: (activeKey) => {
    //     setActiveZone(activeKey);
    //     //  Show only selected zone(hide all zone boundary layers).
    //     Object.entries(zoneLayersRef.current).forEach(([key, layer]) => {
    //       layer.setVisible(key === activeKey);
    //     });



    //     const zoneLayer = zoneLayersRef.current[activeKey];
    //     if (!zoneLayer) return;

    //     const source = zoneLayer.getSource();
    //     const view = mapInstance.current.getView();

    //     //  IMPORTANT: force WFS reload
    //     source.refresh();


    //     const zoomWhenReady = () => {
    //       const extent = source.getExtent();
    //       if (isExtentEmpty(extent)) return;

    //       view.fit(extent, {
    //         padding: [30, 30, 30, 30],
    //         maxZoom: 15,
    //         duration: 700,
    //       });
    //     };

    //     // Wait until WFS is actually ready
    //     const listener = source.on("change", () => {
    //       if (source.getState() === "ready") {
    //         zoomWhenReady();
    //         source.un("change", listener);
    //       }
    //     });
    //   },
    // };

    mapApiRef.current = {

      toggleZone: (zoneKey) => {
        setActiveZone(zoneKey);

        //  Show only selected boundary
        Object.entries(zoneLayersRef.current).forEach(([key, layer]) => {
          layer.setVisible(key === zoneKey);
        });

        //  Hide all sublayers
        Object.values(subLayerMapping).forEach(layers => {
          Object.values(layers).forEach(layer => {
            if (layer) layer.setVisible(false);
          });
        });

        //  Reset sublayer state
        setSelectedSubLayers({});

        //  Close summary
        setSummaryOpen(false);

        //  Clear legend
        const legendDiv = document.getElementById("legend1");
        if (legendDiv) {
          legendDiv.innerHTML = "";
          legendDiv.style.display = "none";
        }

        //  Zoom to zone
        const zoneLayer = zoneLayersRef.current[zoneKey];
        if (!zoneLayer) return;

        const source = zoneLayer.getSource();
        const view = mapInstance.current.getView();

        source.refresh();

        const listener = source.on("change", () => {
          if (source.getState() === "ready") {
            const extent = source.getExtent();
            if (!isExtentEmpty(extent)) {
              view.fit(extent, {
                padding: [30, 30, 30, 30],
                maxZoom: 15,
                duration: 700,
              });
            }
            source.un("change", listener);
          }
        });
      },

      toggleSubLayers: (zoneKey, updated) => {
        const mapping = subLayerMapping[zoneKey];
        if (!mapping) return;

        Object.entries(mapping).forEach(([subKey, layer]) => {
          if (!layer) return;

          const shouldShow = !!updated[subKey];
          layer.setVisible(shouldShow);

          if (subKey === "road" && !shouldShow) {
            const source = layer.getSource();
            if (source?.updateParams) {
              source.updateParams({ STYLES: "" });
              source.refresh();
            }
          }
        });

        setSelectedSubLayers(prev => ({
          ...prev,
          [zoneKey]: updated,
        }));
      }

    };


    // mapApiRef.current.toggleSubLayers = (zoneKey, selectedSubLayers) => {
    //   setSelectedSubLayers(prev => ({
    //     ...prev,
    //     [zoneKey]: selectedSubLayers,
    //   }));
    //   const mapping = subLayerMapping[zoneKey];
    //   if (!mapping) return;


    //   Object.entries(mapping).forEach(([subKey, layer]) => {
    //     if (!layer) return;
    //     layer.setVisible(!!selectedSubLayers[subKey]); // true if checked
    //   });
    // };
    mapApiRef.current.toggleSubLayers = (zoneKey, updated) => {
      const mapping = subLayerMapping[zoneKey];
      if (!mapping) return;

      Object.entries(mapping).forEach(([subKey, layer]) => {
        if (!layer) return;

        const shouldShow = !!updated[subKey];
        layer.setVisible(shouldShow);

        // reset style if road hidden
        if (subKey === "road" && !shouldShow) {
          const source = layer.getSource();
          if (source?.updateParams) {
            source.updateParams({ STYLES: "" });
            source.refresh();
          }
        }
      });

      setSelectedSubLayers(prev => ({
        ...prev,
        [zoneKey]: updated,
      }));
    };

  }, []);


  useEffect(() => {
    if (
      activeZone === "kanpurZone" &&
      !selectedSubLayers?.kanpurZone?.road
    ) {
      setSummaryOpen(false);
    }
  }, [selectedSubLayers, activeZone]);




  const switchBaseMap = (type) => {
    Object.entries(baseLayersRef.current).forEach(([key, layer]) => {
      layer.setVisible(key === type);
    });
    setActiveBase(type);
  };
  // for hiding legend
  useEffect(() => {
    const legendDiv = document.getElementById("legend1");
    if (!legendDiv) return;

    //  hide legend if Kanpur road layer is not active
    if (
      activeZone !== "kanpurZone" ||
      !selectedSubLayers?.kanpurZone?.road ||
      !summaryOpen
    ) {
      legendDiv.style.display = "none";
      legendDiv.innerHTML = "";
    }
  }, [activeZone, selectedSubLayers, summaryOpen]);


  //   useEffect(() => {
  //     const roadLayer = kanpurRoadLayerRef.current;
  //     const roadSource = kanpurRoadSourceRef.current;

  //     if (!roadLayer || !roadSource) return;

  //     const shouldShow =
  //       activeZone === "kanpurZone" &&
  //       selectedSubLayers?.kanpurZone?.road;

  //     // 🔹 Control VISIBILITY
  //     roadLayer.setVisible(shouldShow);

  //     // reset style when hiding
  //     if (!shouldShow) {
  //   roadSource.updateParams({ STYLES: "" });
  //   roadSource.refresh();
  // }

  //   }, [activeZone, selectedSubLayers]);
  // useEffect(() => {
  //   if (activeZone !== "kanpurZone") {
  //     setSelectedSubLayers(prev => ({
  //       ...prev,
  //       kanpurZone: {
  //         ...prev.kanpurZone,
  //         road: false,
  //         ward: false,
  //         amenities: false,
  //       },
  //     }));
  //   }
  // }, [activeZone]);
  const toggleScanFilter = (field, value) => {

    setTempScanFilters(prev => {

      const current = prev[field] || [];

      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];

      return {
        ...prev,
        [field]: updated
      };

    });

  };
  const filters = [
    { key: "ownership", label: "OWNERSHIP" },
    { key: "category", label: "CATEGORY" },
    { key: "condition", label: "CONDITION" },
    { key: "material", label: "MATERIAL" },
    { key: "rowcls", label: "ROW" },
    { key: "drain_type", label: "DRAIN" }
  ];
  useEffect(() => {

    if (summaryOpen) {
      setScanOpen(false); // CLOSED by default
    }

  }, [summaryOpen]);
  const applyScanFilters = () => {

    setScanFilters(tempScanFilters);

  };

  const clearScanFilters = () => {

    setTempScanFilters({});
    setScanFilters({});

  };

  useEffect(() => {

    if (!summaryOpen) {

      // close scan panel
      setScanOpen(false);

      // clear applied filters
      setScanFilters({});

      // clear checkbox temp state
      setTempScanFilters({});

    }

  }, [summaryOpen]);
  const searchRoads = async (text) => {
    if (!text) {
      setSearchResults([]);
      return;
    }

    try {
      const res = await fetch(
        `http://localhost:3000/api/roads/search?q=${text}`
      );

      const data = await res.json();
      setSearchResults(data);

    } catch (err) {
      console.error("Search failed", err);
    }
  };
  useEffect(() => {
    const delay = setTimeout(() => {
      searchRoads(searchText);
    }, 400); // debounce

    return () => clearTimeout(delay);
  }, [searchText]);
  const handleSearchSelect = (road) => {

    setSearchOpen(false);
    setSearchText(road.road_name);

    if (!mapInstance.current) return;

    const view = mapInstance.current.getView();

    // If you have geometry (recommended)
    if (road.geom) {

      const format = new GeoJSON();
      const feature = format.readFeature(road.geom);

      const extent = feature.getGeometry().getExtent();

      view.fit(extent, {
        padding: [50, 50, 50, 50],
        maxZoom: 17,
        duration: 800,
      });

    } else {
      // fallback: use lat/lon if available
      view.animate({
        center: [road.lon, road.lat],
        zoom: 16,
        duration: 800,
      });
    }
  };
  const handleSearchCancel = () => {

    // clear UI
    setSearchText("");
    setSearchResults([]);
    setSearchOpen(false);

    if (!mapInstance.current) return;

    const view = mapInstance.current.getView();

    const roadSource = kanpurRoadSourceRef.current;

    if (!roadSource) return;


    // fallback (if extent not available)
    view.animate({
      center: [80.3319, 26.4499], // Kanpur approx
      zoom: 12,
      duration: 600,
    });


  };

  useEffect(() => {
  const roadSource = kanpurRoadSourceRef.current;

  if (!roadSource) return;

  // apply only when road layer is active
  if (
    activeZone === "kanpurZone" &&
    selectedSubLayers?.kanpurZone?.road
  ) {
    roadSource.updateParams({
      CQL_FILTER: `
        length_km >= ${lengthRange[0]}
        AND length_km <= ${lengthRange[1]}
      `,
      _t: Date.now()
    });
  }

}, [lengthRange, activeZone, selectedSubLayers]);
useEffect(() => {
  if (
    activeZone !== "kanpurZone" ||
    !selectedSubLayers?.kanpurZone?.road
  ) {
    setLengthRange([0, 10]);

    const roadSource = kanpurRoadSourceRef.current;
    if (roadSource) {
      roadSource.updateParams({
        CQL_FILTER: "",
        _t: Date.now()
      });
    }
  }
}, [activeZone, selectedSubLayers]);
useEffect(() => {

  const fetchLengthStats = async () => {
    try {

      const params = new URLSearchParams();

      
      // add slider filters
      params.append("length_min", lengthRange[0]);
      params.append("length_max", lengthRange[1]);

      const res = await fetch(
        `http://localhost:3000/api/summary/roads?${params.toString()}`
      );

      const data = await res.json();

      setLengthStats(data);

    } catch (err) {
      console.error("Length stats error", err);
    }
  };

  // debounce (important for performance)
  const delay = setTimeout(fetchLengthStats, 300);

  return () => clearTimeout(delay);

}, [lengthRange, activeZone]);
  return (
    <>
      <div
        ref={mapRef}
        id="map"
        style={{ height: "calc(100vh - 56px)" }}
      />

      <div id="legend1" className="map-legend" />
      <div id="latlon-panel" className="latlon-panel">
        <span id="latlon-text">Lat: ---, Lon: ---</span>
      </div>
      <button
        className={`jumper-btn ${jumperOpen ? "active" : ""}`}
        onClick={() => {
          setJumperOpen(v => !v);
          document.getElementById("coord-jump-panel")?.classList.toggle("open");
        }}
      >
        <svg
          className="jumper-icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 10c0 6-9 12-9 12S3 16 3 10a9 9 0 1 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>

        <span className="jumper-label">Jumper</span>
      </button>



      {/* Coordinate Jump Panel */}
      <div id="coord-jump-panel" className="coord-jump-panel">
        <input
          id="lat-input"
          type="number"
          step="any"
          placeholder="Latitude"
        />
        <input
          id="lon-input"
          type="number"
          step="any"
          placeholder="Longitude"
        />
        <button id="jump-btn">Go</button>
      </div>
      {activeZone === "kanpurZone" && selectedSubLayers?.kanpurZone?.road && (

        <>
          {/* Summary Button */}
          <button
            className={`summary-btn ${summaryOpen ? "active" : ""}`}
            onClick={() => setSummaryOpen(v => !v)}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 3h18v18H3z" />
              <path d="M7 7h10M7 12h10M7 17h6" />
            </svg>

            <span className="summary-label">Summary</span>
          </button>


          {/* <SummaryPanel
    isOpen={summaryOpen}
    onClose={() => setSummaryOpen(false)}
/> */}

          <SummaryPanel
            isOpen={summaryOpen}
            onClose={() => setSummaryOpen(false)}
            roadWmsSource={kanpurRoadSourceRef.current}
            scanOpen={scanOpen}
            setScanOpen={setScanOpen}
            scanFilters={scanFilters}
            setScanFilters={setScanFilters}
            scanOptions={scanOptions}
            setScanOptions={setScanOptions}
          />


        </>



      )}
      {scanOpen && (
        <div className="scan-panel">

          {filters.map(f => (

            <div key={f.key} className="scan-group">

              <div className="scan-title">
                {f.label}
              </div>

              {scanOptions[f.key]?.map(val => (

                <label key={val} className="scan-option">

                  <input
                    type="checkbox"
                    checked={tempScanFilters[f.key]?.includes(val) || false}
                    onChange={() => toggleScanFilter(f.key, val)}
                  />

                  <span>{val}</span>

                </label>

              ))}

            </div>

          ))}
          <div className="scan-actions">

            <button
              className="scan-btn apply-btn"
              onClick={applyScanFilters}
            >
              Apply
            </button>

            <button
              className="scan-btn clear-btn"
              onClick={clearScanFilters}
            >
              Clear
            </button>

          </div>
        </div>
      )}
      {activeZone === "kanpurZone" && selectedSubLayers?.kanpurZone?.road && (
        <div className="search-panel">
          <div className="search-input-wrapper">
            <input
              type="text"
              placeholder="Search road name..."
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setSearchOpen(true);
              }}
            />

            {searchText && (
              <button
                className="search-cancel-btn"
                onClick={handleSearchCancel}
              >
                ✕
              </button>
            )}

          </div>
          {searchOpen && searchResults.length > 0 && (
            <div className="search-results">

              {searchResults.map((item, i) => (
                <div
                  key={i}
                  className="search-item"
                  onClick={() => handleSearchSelect(item)}
                >
                  {item.road_name} (Ward {item.ward_no})
                </div>
              ))}

            </div>
          )}

        </div>)}

        <button
  className={`length-btn ${lengthOpen ? "active" : ""}`}
  onClick={() => setLengthOpen(v => !v)}
>
  
  <span className="length-label">Length</span>
</button>
          
{lengthOpen && (
  <div className="length-panel">

    <div className="length-title">ROAD LENGTH (km)</div>

    <div className="length-values">
      {lengthRange[0]} - {lengthRange[1]} km
    </div>

    {/* 🔥 NEW STATS */}
  <div className="length-stats">
    <div>Total Roads: {lengthStats.total_roads}</div>
    <div>Total Length: {lengthStats.total_length_km.toFixed(2)} km</div>
  </div>

    <input
      type="range"
      min="0"
      max="10"
      step="0.5"
      value={lengthRange[0]}
      onChange={(e) =>
        setLengthRange([parseFloat(e.target.value), lengthRange[1]])
      }
    />

    <input
      type="range"
      min="0"
      max="10"
      step="0.5"
      value={lengthRange[1]}
      onChange={(e) =>
        setLengthRange([lengthRange[0], parseFloat(e.target.value)])
      }
    />

    <button
      className="length-reset"
      onClick={() => setLengthRange([0, 10])}
    >
      Reset
    </button>

  </div>
)}
      <BaseLayerSwitcher
        activeBase={activeBase}
        onSwitch={switchBaseMap}
      />
    </>

  );
}

export default MapView;
