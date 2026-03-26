import { MsalProvider, useIsAuthenticated, useMsal } from "@azure/msal-react";
import { PublicClientApplication } from "@azure/msal-browser";
import { msalConfig, apiScopes } from "./authConfig";
import Chat from "./Chat";

const pca = new PublicClientApplication(msalConfig);

function LoginScreen() {
  const { instance } = useMsal();

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "#0a0e1a",
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
    }}>
      <div style={{
        border: "1px solid #1e3a5f",
        padding: "48px 56px",
        textAlign: "center",
        background: "#0d1526",
        maxWidth: 400,
      }}>
        <div style={{ fontSize: 11, letterSpacing: 4, color: "#4a9eff", marginBottom: 8 }}>
          MICROSOFT SENTINEL
        </div>
        <h1 style={{ color: "#e8f4ff", fontSize: 22, margin: "0 0 8px", fontWeight: 600 }}>
          MCP Agent
        </h1>
        <p style={{ color: "#4a6080", fontSize: 13, marginBottom: 36 }}>
          Sign in with your work account to continue
        </p>
        <button
          onClick={() => instance.loginRedirect({ scopes: apiScopes })}
          style={{
            background: "#1a56db",
            color: "#fff",
            border: "none",
            padding: "12px 32px",
            fontSize: 13,
            letterSpacing: 1,
            cursor: "pointer",
            width: "100%",
          }}
        >
          SIGN IN WITH ENTRA ID
        </button>
      </div>
    </div>
  );
}

function Shell() {
  const isAuth = useIsAuthenticated();
  return isAuth ? <Chat /> : <LoginScreen />;
}

export default function App() {
  return (
    <MsalProvider instance={pca}>
      <Shell />
    </MsalProvider>
  );
}
