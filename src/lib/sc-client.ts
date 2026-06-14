/**
 * SoundCloud API client -- OAuth 2.1 Token-Exchange, Follow, Like.
 * Auth header: Authorization: OAuth ***
 */

const SC_BASE = "https://api.soundcloud.com";
const SC_AUTH="https://secure.soundcloud.com";

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export interface CurrentUserResponse {
  id?: number | string;
  urn?: string;
  permalink?: string;
  username?: string;
}

export async function exchangeToken(params: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
  codeVerifier: string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    code_verifier: params.codeVerifier,
  });

  const res = await fetch(`${SC_AUTH}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  return (await res.json()) as TokenResponse;
}

export async function getCurrentUser(accessToken: string): Promise<CurrentUserResponse> {
  const res = await fetch(`${SC_BASE}/me`, {
    method: "GET",
    headers: { Authorization: `OAuth ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Current user lookup failed: ${res.status} ${text}`);
  }

  return (await res.json()) as CurrentUserResponse;
}

export async function followArtist(accessToken: string, artistUrn: string): Promise<void> {
  const res = await fetch(`${SC_BASE}/me/followings/${artistUrn}`, {
    method: "PUT",
    headers: { Authorization: `OAuth ${accessToken}` },
  });

  if (res.ok) return;
  const text = await res.text();
  throw new Error(`Follow failed: ${res.status} ${text}`);
}

export async function likeTrack(accessToken: string, trackUrn: string): Promise<void> {
  const res = await fetch(`${SC_BASE}/likes/tracks/${trackUrn}`, {
    method: "POST",
    headers: { Authorization: `OAuth ${accessToken}` },
  });

  if (res.ok) return;
  const text = await res.text();
  throw new Error(`Like failed: ${res.status} ${text}`);
}

export async function repostTrack(accessToken: string, trackUrn: string): Promise<void> {
  const res = await fetch(`${SC_BASE}/reposts/tracks/${trackUrn}`, {
    method: "POST",
    headers: { Authorization: `OAuth ${accessToken}` },
  });

  if (res.ok) return;
  const text = await res.text();
  throw new Error(`Repost failed: ${res.status} ${text}`);
}

export async function postComment(accessToken: string, trackUrn: string, body: string): Promise<void> {
  const res = await fetch(`${SC_BASE}/tracks/${trackUrn}/comments`, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${accessToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ comment: { body } }),
  });

  if (res.ok) return;
  const text = await res.text();
  throw new Error(`Comment failed: ${res.status} ${text}`);
}
