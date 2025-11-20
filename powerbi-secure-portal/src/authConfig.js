export const msalConfig = {
  auth: {
    clientId: "2450ed46-5a7a-4e17-af0a-d2e4ebd4cdae",
    authority: "https://login.microsoftonline.com/291710b8-8a8f-4e2f-8a7c-5e53ef2b22cc",
    redirectUri: window.location.origin,
  },
};

export const loginRequest = {
  scopes: ["User.Read"],
};
