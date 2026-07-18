import React from "react";
import { AppProvider } from "@shopify/polaris";
import CartWidget from "./components/CartWidget";
import Dashboard from "./components/Dashboard/Analytics";
import "@shopify/polaris/build/esm/styles.css";

function App() {
  return (
    <AppProvider>
      <div>
        <h1>Micro-Donation Cart Plugin</h1>
        <CartWidget />
        <Dashboard />
      </div>
    </AppProvider>
  );
}
export default App;