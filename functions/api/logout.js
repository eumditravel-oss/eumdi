import { proxyApi } from "./_proxy.js";

export function onRequest(context) {
  return proxyApi(context, "/api/logout");
}
