import { useState, useRef } from "react";
import Header from "./components/Header";
import Footer from "./components/Footer";
import SidePanel from "./components/sidepanel";
import MapView from "./components/MapView";

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ref to access MapView layer toggles
  const mapApiRef = useRef(null);
const handleZoneToggle = (zoneKey) => {
    if (mapApiRef.current) {
      mapApiRef.current.toggleZone(zoneKey);
    }
  };

  // Handle sub-layer toggle (checkboxes)
  const handleSubLayerToggle = (zoneKey, checkedSubLayers) => {
    if (mapApiRef.current) {
      mapApiRef.current.toggleSubLayers(zoneKey, checkedSubLayers);
    }
  };
  return (
    <>
      <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

      {/* Pass onLayerToggle to SidePanel */}
      <SidePanel
        open={sidebarOpen}
        onZoneToggle={handleZoneToggle}
        onSubLayerToggle={handleSubLayerToggle}
        onLayerToggle={(zoneKey) =>
          mapApiRef.current?.toggleZone(zoneKey)
        }
      />


      <MapView mapApiRef={mapApiRef} />

      <Footer />
    </>
  );
}

export default App;

