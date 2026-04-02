
function Header({onToggleSidebar}) {
  
  return (
    <header className="header">
        {/* Left: Sidebar Toggle */}
        <div className="header-left">
        <button className="sidebar-toggle" onClick={onToggleSidebar}>
          ☰
        </button>
      </div>

      {/* Center title */}
      <div className="header-center">
        WEB GIS PORTAL
      </div>

      {/* Right logo */}
      <div className="header-right">
        <img
          src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Seal_of_Uttar_Pradesh.svg/1200px-Seal_of_Uttar_Pradesh.svg.png"
          alt="UP Logo"
          className="header-logo"
        />
      </div>
      
    </header>
  );
}
export default Header;
