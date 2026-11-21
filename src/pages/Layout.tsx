import { NavLink, Outlet } from "react-router";
import { foodGraceDays } from "../simulation"; // Verwendet dieselbe Frist wie die Simulation.
import { ResourceBar } from "../components/ResourceBar";
import { useColony } from "../state/ColonyContext";

export function Layout() {
  const { colony, paused, togglePaused, acknowledgeFoodShortage } = useColony(); // Liest den Spielstand und die Aktion fuer OK.
  const shortage = colony.foodShortage; // Liefert die verbleibende Zeit und den Status der Warnung.

  if (shortage?.daysRemaining === 0) { // Ersetzt die Spieloberflaeche nach Ablauf der Frist.
    return ( // Zeigt den Endbildschirm mit dem Grund und einer Neustartaktion.
      <main className="survival-end">
        {/* Der Endbildschirm zeigt nur den Ausgang und den Neustart. */}
        <section className="panel survival-panel" aria-labelledby="game-over-title">
          {/* Die Ueberschrift benennt den Endbildschirm. */}
          <h1 id="game-over-title">Game Over</h1>
          {/* Der Text erklaert, warum die Kolonie verloren hat. */}
          <p>Stonehome ran out of food and could not restore its supply in time.</p>
          {/* Der Neustart oeffnet eine frische Kolonie auf der Startseite. */}
          <button type="button" onClick={() => window.location.assign("/")}>Restart</button>
        </section>{/* Schliesst den Inhalt des Endbildschirms ab. */}
      </main>
    ); // Gibt beim Spielende keinen Zugriff mehr auf die Spielaktionen.
  } // Laesst die normale Oberflaeche nur bei laufendem Spiel erscheinen.

  return (
    <main>
      <header className="masthead">
        <div className="brand">
          <b>⛏</b>
          <div>
            <small>THE DEEP REALMS OF</small>
            <h1>
              Dwarf<span>hold</span>
            </h1>
          </div>
        </div>

        <div className="hold-title">
          <small>COLONY</small>
          <strong>STONEHOME</strong>
          <span>Founded beneath Emberpeak</span>
        </div>

        <div className="day">
          <small>DEEP DAY</small>
          <strong>{colony.day}</strong>
          <button onClick={togglePaused}>
            {paused ? "Wake the hold" : "Pause"}
          </button>
        </div>
      </header>

      <nav className="main-nav" aria-label="Colony navigation">
        <NavLink to="/" end>
          Colony
        </NavLink>
        <NavLink to="/forge">Forge</NavLink>
      </nav>

      <ResourceBar resources={colony.resources} />
      {/* Die Regel steht direkt unter den Rohstoffen. */}
      <p className="food-rule" role="status">
        {/* Nach OK zeigt dieser Text die Frist, sonst die allgemeine Regel. */}
        {shortage?.acknowledged
          ? `Days left to restore your food supply: ${shortage.daysRemaining}.` // Zeigt die verbleibenden Spieltage an.
          : `If food runs out, you have ${foodGraceDays} days to restore your food supply before the game ends.`}
      </p>{/* Schliesst die Statusanzeige fuer Essen. */}
      {/* Das Popup erscheint einmal beim Beginn jeder Knappheit. */}
      {shortage && !shortage.acknowledged && (
        <dialog className="panel survival-panel" aria-labelledby="food-warning"
          ref={(dialog) => { dialog?.showModal(); }} // Oeffnet das Popup modal und blockiert Aktionen im Hintergrund.
          onCancel={(event) => event.preventDefault()} // Verhindert das Schliessen mit Escape, damit OK erforderlich bleibt.
        >
          {/* Der Hinweis nennt die Frist im vereinbarten Wortlaut. */}
          <p id="food-warning">Out of food! You have 3 days to gather food.</p>
          {/* OK bestaetigt die Warnung und laesst die Uhr weiterlaufen. */}
          <button type="button" onClick={acknowledgeFoodShortage}>OK</button>
        </dialog>
      )}
      <Outlet />

      <footer>
        <span>🔥 Forge: burning</span>
        <span>{paused ? "Deep day timer paused" : "Next deep day in ~8 seconds"}</span>{/* Zeigt an, ob die Uhr gerade laeuft. */}
        <span>{paused ? "The hold is resting" : "⚙ Simulation active"}</span>
      </footer>
    </main>
  );
}
