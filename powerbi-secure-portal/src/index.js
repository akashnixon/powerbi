import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";

import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "./authConfig";

// ----------------------------------------------------
// CREATE MSAL INSTANCE
// ----------------------------------------------------
const msalInstance = new PublicClientApplication(msalConfig);

// ----------------------------------------------------
// INITIALIZE MSAL (required in msal-browser v3+)
// ----------------------------------------------------
async function startApp() {
  // Wait for MSAL to initialize
  await msalInstance.initialize();

  // After initialization, handle redirect response
  const result = await msalInstance.handleRedirectPromise();

  if (result && result.account) {
    // Login happened just now → set the active account
    msalInstance.setActiveAccount(result.account);
  } else {
    // If no redirect result, use the first cached account
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 1) {
      msalInstance.setActiveAccount(accounts[0]);
    }
  }

  // Now we can safely render React
  const root = ReactDOM.createRoot(document.getElementById("root"));

  root.render(
    <MsalProvider instance={msalInstance}>
      <App />
    </MsalProvider>
  );
}

startApp();

reportWebVitals();
