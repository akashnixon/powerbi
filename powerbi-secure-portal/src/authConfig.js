export const msalConfig = {
  auth: {
    clientId: "2450ed46-5a7a-4e17-af0a-d2e4ebd4cdae",
    authority: "https://login.microsoftonline.com/common",
    redirectUri: window.location.origin,
  },
};

export const loginRequest = {
  scopes: ["User.Read"],
};