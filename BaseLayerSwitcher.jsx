import { useState } from "react";

function BaseLayerSwitcher({ activeBase, onSwitch }) {
    const [open, setOpen] = useState(false);

    const handleSwitch = (type) => {
        onSwitch(type);
    };

    return (
        <div className="basemap-container">
            <button
                className={`basemap-btn ${open ? "active" : ""}`}
                onClick={() => setOpen(prev => !prev)}
            >
                <svg className="basemap-icon" width="18" height="18" viewBox="0 0 24 24">
                    <rect x="3" y="3" width="8" height="8" />
                    <rect x="13" y="3" width="8" height="8" />
                    <rect x="3" y="13" width="8" height="8" />
                    <rect x="13" y="13" width="8" height="8" />
                </svg>

                <span className="basemap-label">Basemap</span>
            </button>


            {/* Panel */}
            {open && (
                <div className="basemap-panel">
                    <button
                        className={`basemap-option ${activeBase === "OSM" ? "active" : ""}`}
                        onClick={() => handleSwitch("OSM")}
                    >
                        OSM
                    </button>

                    <button
                        className={`basemap-option ${activeBase === "SATELLITE" ? "active" : ""}`}
                        onClick={() => handleSwitch("SATELLITE")}
                    >
                        Satellite
                    </button>
                </div>
            )}

        </div>
    );

}

export default BaseLayerSwitcher;

