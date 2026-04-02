import { useState } from "react";

const ZONES = [
  {
    key: "kanpurZone",
    label: "KANPUR ZONE",
    subLayers: ["ward", "road", "amenities"],
  },
  {
    key: "lucknowZone",
    label: "LUCKNOW ZONE",
    subLayers: ["ward", "road", "amenities"],
  },
];





function SidePanel({ open, onZoneToggle, onSubLayerToggle }) {
  const [activeTab, setActiveTab] = useState("layers");
  const [activeZone, setActiveZone] = useState(null); // selected zone
  const [selectedSubLayers, setSelectedSubLayers] = useState({}); // track checked sub-layers
  


  // Toggle sub-layer checkbox
  const handleSubLayerChange = (zoneKey, subLayer) => {
  setSelectedSubLayers(prev => {
    const prevState = prev[zoneKey] || {};
    const newState = { ...prevState, [subLayer]: !prevState[subLayer] };

    return { ...prev, [zoneKey]: newState };
  });

  // parent update AFTER state scheduling
  onSubLayerToggle(zoneKey, {
    ...(selectedSubLayers[zoneKey] || {}),
    [subLayer]: !selectedSubLayers?.[zoneKey]?.[subLayer],
  });
};






  return (
    <aside className={`side-panel ${open ? "open" : ""}`}>
      {/* Top Tabs */}
      <div className="side-tabs">
        {["layers", "amenities", "cmp"].map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="side-content">
        {activeTab === "layers" && (
          <div className="panel-section">
            {ZONES.map((zone) => (
              <div key={zone.key} style={{ marginBottom: "10px" }}>
                {/* Main Zone radio button */}
                <label className="checkbox-item">
                  <input
                    type="radio"
                    name="zone"
                    checked={activeZone === zone.key}
                    onChange={() => {
                      setActiveZone(zone.key);
                      setSelectedSubLayers({});
                      onZoneToggle(zone.key);
                    }}
                  />
                  {zone.label}
                </label>

                {activeZone === zone.key && (
                  <div
                    className="sub-layer-options"
                    style={{ marginLeft: "20px", marginTop: "5px" }}
                  >
                    {zone.subLayers.map((sub) => (
                      <label key={sub} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={selectedSubLayers[zone.key]?.[sub] || false}
                          onChange={() => handleSubLayerChange(zone.key, sub)}
                        />
                        {sub.charAt(0).toUpperCase() + sub.slice(1)}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
          

        {activeTab === "summary" && (
          <div className="panel-section">
            <h4>Summary</h4>
            <p>Summary renders here</p>
          </div>
        )}

        {activeTab === "charts" && (
          <div className="panel-section">
            <h4>Charts</h4>
            <p>Charts will be added here</p>
          </div>
        )}
      </div>
    </aside>
  );
}

export default SidePanel;
