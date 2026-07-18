import React, { useEffect, useState } from "react";

function Settings() {
  const [charity, setCharity] = useState("");

  useEffect(() => {
    async function fetchSettings() {
      const response = await fetch("/api/merchants/settings");
      const data = await response.json();
      setCharity(data.defaultCharity || "");
    }
    fetchSettings();
  }, []);

  const handleSave = async () => {
    try {
      await fetch("/api/merchants/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultCharity: charity }),
      });
      alert("Settings saved!");
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="dashboard-settings">
      <h2>Merchant Settings</h2>
      <label>
        Default Charity:
        <input type="text" value={charity} onChange={e => setCharity(e.target.value)} />
      </label>
      <button onClick={handleSave}>Save</button>
    </div>
  );
}

export default Settings;