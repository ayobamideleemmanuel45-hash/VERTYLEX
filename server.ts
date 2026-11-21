import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {GoogleGenAI, ThinkingLevel, Type} from '@google/genai';
import dotenv from 'dotenv';
import express, {type NextFunction, type Request, type Response} from 'express';
import nodemailer from 'nodemailer';
import {createServer as createViteServer} from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'vertylex-store.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const SECRET_PATH = path.join(DATA_DIR, '.session-secret');
const OFFICIAL_EMAIL = 'vertylexvtylex@gmail.com';
const COOKIE_NAME = 'vertylex_session';
const SHORT_SESSION_TTL_MS = 1000 * 60 * 60 * 2; // 2 hours (when Remember Me is not selected)
const REMEMBER_ME_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days (when Remember Me is selected)
const RATES_CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'customer';
  passwordSalt: string;
  passwordHash: string;
  countryCode?: string;
  countryName?: string;
  stateRegion?: string;
  preferredCurrency?: string;
  createdAt: string;
}

interface StoredResetToken {
  tokenHash: string;
  userId: string;
  email: string;
  expiresAt: number;
  used: boolean;
}

interface ProjectQuotation {
  amountUsd: number;
  paymentOption: 'full' | 'deposit';
  depositPercent: number;
  dueNowUsd: number;
  amount: number;
  currency: string;
  customerDisplayCurrency?: string;
  customerEstimatedTotal?: number;
  customerEstimatedDueNow?: number;
  exchangeRateAtQuote?: number;
  rateSourceAtQuote?: string;
  summary: string;
  deliverables: string[];
  validUntil: string;
  quotedAt: string;
  quotedBy: string;
  acceptedAt?: string;
  declinedAt?: string;
  declineReason?: string;
}

interface StoredAttachment {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  storedName: string;
  uploadedAt: string;
}

interface ProjectInternalNote {
  id: string;
  authorEmail: string;
  authorName: string;
  text: string;
  createdAt: string;
}

interface ProjectUpdateMessage {
  id: string;
  senderRole: 'admin' | 'customer';
  senderName: string;
  senderEmail: string;
  message: string;
  requiresAction?: boolean;
  createdAt: string;
}

interface ProjectAuditEntry {
  id: string;
  actorEmail: string;
  actorRole: 'admin' | 'customer' | 'system';
  action: string;
  details: string;
  createdAt: string;
}

interface StoredNotification {
  id: string;
  recipientRole: 'admin' | 'customer';
  recipientUserId: string | null;
  projectId: string | null;
  projectReferenceId: string | null;
  type:
    | 'new_project'
    | 'project_status'
    | 'info_requested'
    | 'customer_reply'
    | 'quotation_sent'
    | 'quotation_accepted'
    | 'quotation_declined'
    | 'payment_confirmed'
    | 'project_cancelled';
  title: string;
  message: string;
  linkPath: string;
  read: boolean;
  emailSent?: boolean;
  createdAt: string;
}

interface StoredProject {
  id: string;
  referenceId: string;
  userId: string | null;
  fullName: string;
  email: string;
  countryCode?: string;
  countryName?: string;
  stateRegion?: string;
  businessName: string;
  selectedService: string;
  projectTitle: string;
  ideaDescription: string;
  budgetRange: string;
  budgetUsd?: number;
  recommendedBudgetUsd?: number;
  budgetMinUsd?: number;
  budgetMaxUsd?: number;
  budgetDisplayCurrency?: string;
  budgetEstimatedLocalAmount?: number;
  budgetExchangeRateAtSubmit?: number;
  deliveryTime?: string;
  deliveryTimeStatus?: 'Pending Review' | 'Achievable as Requested' | 'Adjusted by Administrator';
  confirmedDeliveryTime?: string;
  additionalRequirements: string;
  serviceDetails?: Record<string, string | string[]>;
  attachments?: StoredAttachment[];
  idempotencyKey?: string;
  progressStage?: string;
  preferredRegion?: string;
  preferredCurrency?: string;
  status: string;
  quotation: ProjectQuotation | null;
  internalNotes?: ProjectInternalNote[];
  updates?: ProjectUpdateMessage[];
  auditLog?: ProjectAuditEntry[];
  createdAt: string;
  updatedAt?: string;
}

interface StoredContact {
  id: string;
  referenceId: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
}

interface StoredPayment {
  id: string;
  reference: string;
  projectId: string;
  projectReferenceId: string;
  projectTitle: string;
  userId: string;
  customerEmail?: string;
  customerName?: string;
  provider: 'paystack' | 'flutterwave';
  amountUsd?: number;
  amount: number;
  currency: string;
  displayAmount?: number;
  displayCurrency?: string;
  exchangeRateUsed?: number;
  feeEstimateNote?: string;
  paymentOption?: 'full' | 'deposit';
  depositPercent?: number;
  status: 'pending' | 'paid' | 'failed';
  authorizationUrl: string;
  gatewayTransactionId?: string;
  channel?: string;
  webhookVerified?: boolean;
  createdAt: string;
  verifiedAt?: string;
}

interface StoredSupportTicket {
  id: string;
  referenceId: string;
  userId: string | null;
  name: string;
  email: string;
  topic: string;
  message: string;
  conversationSummary: string;
  channel: 'web' | 'whatsapp';
  status: string;
  createdAt: string;
}

interface StoredSession {
  idHash: string;
  userId: string;
  rememberMe: boolean;
  expiresAt: number;
  createdAt: string;
}

interface DataStore {
  users: StoredUser[];
  sessions: StoredSession[];
  resetTokens: StoredResetToken[];
  projects: StoredProject[];
  contacts: StoredContact[];
  payments: StoredPayment[];
  supportTickets: StoredSupportTicket[];
  notifications: StoredNotification[];
}

interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'customer';
  countryCode?: string;
  countryName?: string;
  stateRegion?: string;
  preferredCurrency?: string;
  createdAt: string;
}

const DEFAULT_STORE: DataStore = {
  users: [],
  sessions: [],
  resetTokens: [],
  projects: [],
  contacts: [],
  payments: [],
  supportTickets: [],
  notifications: [],
};

function ensureSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  fs.mkdirSync(DATA_DIR, {recursive: true});
  if (fs.existsSync(SECRET_PATH)) {
    const existing = fs.readFileSync(SECRET_PATH, 'utf8').trim();
    if (existing.length >= 32) {
      return existing;
    }
  }
  const generated = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SECRET_PATH, generated, {mode: 0o600});
  return generated;
}

const SESSION_SECRET = ensureSessionSecret();

let storeQueue: Promise<unknown> = Promise.resolve();

async function readStore(): Promise<DataStore> {
  await fsp.mkdir(DATA_DIR, {recursive: true});
  if (!fs.existsSync(STORE_PATH)) {
    await fsp.writeFile(STORE_PATH, JSON.stringify(DEFAULT_STORE, null, 2), 'utf8');
    return {
      users: [],
      sessions: [],
      resetTokens: [],
      projects: [],
      contacts: [],
      payments: [],
      supportTickets: [],
      notifications: [],
    };
  }
  const raw = await fsp.readFile(STORE_PATH, 'utf8');
  const parsed = JSON.parse(raw) as Partial<DataStore>;
  return {
    users: Array.isArray(parsed.users)
      ? parsed.users.map((u) => ({
          ...u,
          role: u.role === 'admin' ? 'admin' : 'customer',
        }))
      : [],
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    resetTokens: Array.isArray(parsed.resetTokens) ? parsed.resetTokens : [],
    projects: Array.isArray(parsed.projects)
      ? parsed.projects.map((p) => ({
          ...p,
          quotation: p.quotation ?? null,
          internalNotes: Array.isArray(p.internalNotes) ? p.internalNotes : [],
          updates: Array.isArray(p.updates) ? p.updates : [],
          auditLog: Array.isArray(p.auditLog) ? p.auditLog : [],
        }))
      : [],
    contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [],
    payments: Array.isArray(parsed.payments) ? parsed.payments : [],
    supportTickets: Array.isArray(parsed.supportTickets) ? parsed.supportTickets : [],
    notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
  };
}

function mutateStore<T>(fn: (store: DataStore) => Promise<T> | T): Promise<T> {
  const next = storeQueue.then(async () => {
    const store = await readStore();
    const result = await fn(store);
    const tmpPath = `${STORE_PATH}.${crypto.randomUUID()}.tmp`;
    await fsp.writeFile(tmpPath, JSON.stringify(store, null, 2), 'utf8');
    await fsp.rename(tmpPath, STORE_PATH);
    return result;
  });
  storeQueue = next.catch(() => undefined);
  return next;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const ALLOWED_CURRENCY_CODES = new Set([
  'USD',
  'NGN',
  'GBP',
  'EUR',
  'CAD',
  'AUD',
  'GHS',
  'KES',
  'ZAR',
  'INR',
  'AED',
  'SAR',
  'SGD',
  'JPY',
  'KRW',
  'CNY',
  'CHF',
  'SEK',
  'PLN',
  'MXN',
  'BRL',
  'NZD',
  'EGP',
  'MAD',
  'RWF',
  'PHP',
  'MYR',
]);

const PROJECT_STATUSES = [
  'New Request',
  'Under Review',
  'More Information Required',
  'Quotation Sent',
  'Awaiting Customer Approval',
  'Awaiting Payment',
  'Payment Confirmed',
  'In Progress',
  'Completed',
  'Cancelled',
] as const;

const PROJECT_STATUS_SET = new Set<string>(PROJECT_STATUSES);

const SERVICE_BUDGET_RULES: Record<
  string,
  {minUsd: number; recommendedUsd: number; maxUsd: number}
> = {
  'Flyer and Graphic Design': {minUsd: 50, recommendedUsd: 80, maxUsd: 900},
  'Website Development': {minUsd: 200, recommendedUsd: 800, maxUsd: 1500},
  'Branding and Business Promotion': {minUsd: 80, recommendedUsd: 350, maxUsd: 800},
  'Mobile Application Development': {minUsd: 100, recommendedUsd: 190, maxUsd: 700},
  'Business Development': {minUsd: 200, recommendedUsd: 350, maxUsd: 950},
  'Advertising and Marketing': {minUsd: 70, recommendedUsd: 190, maxUsd: 600},
};

function getServiceBudgetRule(
  selectedService: string,
): {minUsd: number; recommendedUsd: number; maxUsd: number} | null {
  const key = selectedService.trim().toLowerCase();
  if (
    key === 'flyer and graphic design' ||
    key === 'flyer & graphic design' ||
    key === 'graphic design' ||
    key === 'graphic-design' ||
    key === 'flyer-and-graphic-design'
  ) {
    return SERVICE_BUDGET_RULES['Flyer and Graphic Design'];
  }
  if (key === 'website development' || key === 'website-development') {
    return SERVICE_BUDGET_RULES['Website Development'];
  }
  if (
    key === 'branding and business promotion' ||
    key === 'branding and growth' ||
    key === 'branding & growth' ||
    key === 'branding' ||
    key === 'branding-and-growth' ||
    key === 'branding-and-business-promotion'
  ) {
    return SERVICE_BUDGET_RULES['Branding and Business Promotion'];
  }
  if (
    key === 'mobile application development' ||
    key === 'mobile app development' ||
    key === 'application development' ||
    key === 'application-development' ||
    key === 'mobile-application-development' ||
    key === 'mobile-app-development'
  ) {
    return SERVICE_BUDGET_RULES['Mobile Application Development'];
  }
  if (key === 'business development' || key === 'business-development') {
    return SERVICE_BUDGET_RULES['Business Development'];
  }
  if (
    key === 'advertising and marketing' ||
    key === 'advertising and promotion' ||
    key === 'advertising & promotion' ||
    key === 'advertising' ||
    key === 'advertising-and-promotion' ||
    key === 'advertising-and-marketing'
  ) {
    return SERVICE_BUDGET_RULES['Advertising and Marketing'];
  }
  return null;
}

const ALLOWED_DELIVERY_TIMES = new Set<string>([
  'Urgent: 1–2 days',
  'Fast: 3–4 days',
  'Standard: 5–7 days',
  'Flexible: 8–14 days',
]);

function sanitizeProjectForCustomer(project: StoredProject): Omit<StoredProject, 'internalNotes' | 'auditLog'> {
  const {internalNotes: _notes, auditLog: _audit, ...safe} = project;
  return safe;
}

function appendAuditEntry(
  project: StoredProject,
  actorEmail: string,
  actorRole: 'admin' | 'customer' | 'system',
  action: string,
  details: string,
): void {
  if (!Array.isArray(project.auditLog)) {
    project.auditLog = [];
  }
  project.auditLog.push({
    id: crypto.randomUUID(),
    actorEmail,
    actorRole,
    action,
    details,
    createdAt: new Date().toISOString(),
  });
}

function pushStoreNotification(
  store: DataStore,
  input: Omit<StoredNotification, 'id' | 'read' | 'createdAt'>,
): StoredNotification {
  const notif: StoredNotification = {
    id: crypto.randomUUID(),
    read: false,
    createdAt: new Date().toISOString(),
    ...input,
  };
  store.notifications.unshift(notif);
  if (store.notifications.length > 500) {
    store.notifications = store.notifications.slice(0, 500);
  }
  return notif;
}

function roundMoneyForCurrency(value: number, currencyCode: string): number {
  const zeroDecimals = new Set(['NGN', 'KES', 'JPY', 'KRW', 'RWF']);
  const upper = currencyCode.toUpperCase();
  if (zeroDecimals.has(upper)) {
    return Math.round(value);
  }
  return Math.round(value * 100) / 100;
}

function normalizeUserLocationInput(input: unknown): {
  countryCode?: string;
  countryName?: string;
  stateRegion?: string;
  preferredCurrency?: string;
} {
  if (!input || typeof input !== 'object') {
    return {};
  }
  const raw = input as Record<string, unknown>;
  const countryCodeRaw = typeof raw.countryCode === 'string' ? raw.countryCode.trim().toUpperCase() : '';
  const countryNameRaw = typeof raw.countryName === 'string' ? raw.countryName.trim() : '';
  const stateRegionRaw = typeof raw.stateRegion === 'string' ? raw.stateRegion.trim() : '';
  const currencyRaw =
    typeof raw.preferredCurrency === 'string' ? raw.preferredCurrency.trim().toUpperCase() : '';

  const countryCode = /^[A-Z]{2}$/.test(countryCodeRaw) ? countryCodeRaw : undefined;
  const countryName =
    countryNameRaw.length >= 2 && countryNameRaw.length <= 80 ? countryNameRaw : undefined;
  const stateRegion =
    stateRegionRaw.length > 0 && stateRegionRaw.length <= 80 ? stateRegionRaw : undefined;
  const preferredCurrency = ALLOWED_CURRENCY_CODES.has(currencyRaw) ? currencyRaw : undefined;

  return {
    ...(countryCode ? {countryCode} : {}),
    ...(countryName ? {countryName} : {}),
    ...(stateRegion ? {stateRegion} : {}),
    ...(preferredCurrency ? {preferredCurrency} : {}),
  };
}

function getAdminEmails(): string[] {
  const configured = process.env.ADMIN_EMAILS || OFFICIAL_EMAIL;
  return configured
    .split(',')
    .map((e) => normalizeEmail(e))
    .filter(Boolean);
}

function isAuthorizedAdminEmail(email: string): boolean {
  return getAdminEmails().includes(normalizeEmail(email));
}

function sanitizeUser(user: StoredUser): SafeUser {
  const effectiveRole: 'admin' | 'customer' =
    user.role === 'admin' && isAuthorizedAdminEmail(user.email) ? 'admin' : 'customer';
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: effectiveRole,
    ...(user.countryCode ? {countryCode: user.countryCode} : {}),
    ...(user.countryName ? {countryName: user.countryName} : {}),
    ...(user.stateRegion ? {stateRegion: user.stateRegion} : {}),
    ...(user.preferredCurrency ? {preferredCurrency: user.preferredCurrency} : {}),
    createdAt: user.createdAt,
  };
}

function isAdminUser(user: SafeUser | null): boolean {
  if (!user) return false;
  return user.role === 'admin' && isAuthorizedAdminEmail(user.email);
}

async function ensureOwnerAdminAccount(): Promise<void> {
  const ownerPassword =
    process.env.ADMIN_OWNER_PASSWORD?.trim() || process.env.ADMIN_INITIAL_PASSWORD?.trim() || '';
  if (ownerPassword.length < 8) {
    return;
  }
  const ownerEmail = getAdminEmails()[0] || OFFICIAL_EMAIL;
  await mutateStore((store) => {
    const existing = store.users.find((u) => normalizeEmail(u.email) === ownerEmail);
    const {salt, hash} = hashPassword(ownerPassword);
    if (existing) {
      existing.role = 'admin';
      existing.passwordSalt = salt;
      existing.passwordHash = hash;
    } else {
      store.users.push({
        id: crypto.randomUUID(),
        name: 'VERTYLEX Owner',
        email: ownerEmail,
        role: 'admin',
        passwordSalt: salt,
        passwordHash: hash,
        createdAt: new Date().toISOString(),
      });
    }
  });
}

function hashPassword(password: string, salt?: string): {salt: string; hash: string} {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return {salt: actualSalt, hash: derived};
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  if (actual.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(actual, expected);
}

interface VerifiedTokenPayload {
  uid: string;
  sid: string;
  rm: boolean;
  exp: number;
}

function hashSessionId(sid: string): string {
  return crypto.createHash('sha256').update(sid).digest('hex');
}

function signSessionToken(payloadObj: VerifiedTokenPayload): string {
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifySessionToken(token: string): VerifiedTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }
  const [payload, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      uid?: string;
      sid?: string;
      rm?: boolean;
      exp?: number;
    };
    if (!decoded.uid || !decoded.sid || !decoded.exp || decoded.exp < Date.now()) {
      return null;
    }
    return {
      uid: decoded.uid,
      sid: decoded.sid,
      rm: Boolean(decoded.rm),
      exp: decoded.exp,
    };
  } catch {
    return null;
  }
}

function createStoredSession(
  store: DataStore,
  userId: string,
  rememberMe: boolean,
): {token: string; rememberMe: boolean; ttlMs: number; expiresAt: number} {
  const now = Date.now();
  store.sessions = store.sessions.filter((s) => s.expiresAt > now);
  const ttlMs = rememberMe ? REMEMBER_ME_TTL_MS : SHORT_SESSION_TTL_MS;
  const expiresAt = now + ttlMs;
  const sid = crypto.randomUUID();
  store.sessions.push({
    idHash: hashSessionId(sid),
    userId,
    rememberMe,
    expiresAt,
    createdAt: new Date(now).toISOString(),
  });
  const token = signSessionToken({uid: userId, sid, rm: rememberMe, exp: expiresAt});
  return {token, rememberMe, ttlMs, expiresAt};
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }
  const result: Record<string, string> = {};
  for (const pair of cookieHeader.split(';')) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }
    const key = pair.slice(0, eqIndex).trim();
    const value = pair.slice(eqIndex + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(value);
      } catch {
        result[key] = value;
      }
    }
  }
  return result;
}

function isHttpsRequest(req: Request): boolean {
  if (req.secure) {
    return true;
  }
  const xfProto = req.headers['x-forwarded-proto'];
  if (typeof xfProto === 'string' && xfProto.split(',')[0].trim().toLowerCase() === 'https') {
    return true;
  }
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin.startsWith('https://')) {
    return true;
  }
  const referer = req.headers.referer;
  if (typeof referer === 'string' && referer.startsWith('https://')) {
    return true;
  }
  return false;
}

function setSessionCookie(
  req: Request,
  res: Response,
  token: string,
  options: {rememberMe: boolean; ttlMs: number},
): void {
  const isHttps = isHttpsRequest(req);
  const parts = [`${COOKIE_NAME}=${encodeURIComponent(token)}`, 'Path=/', 'HttpOnly'];
  if (options.rememberMe) {
    parts.push(`Max-Age=${Math.floor(options.ttlMs / 1000)}`);
  }
  if (isHttps) {
    parts.push('SameSite=None', 'Secure', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(req: Request, res: Response): void {
  const isHttps = isHttpsRequest(req);
  const parts = [`${COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'Max-Age=0'];
  if (isHttps) {
    parts.push('SameSite=None', 'Secure', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function extractRequestSessionToken(req: Request): string | null {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[COOKIE_NAME]) {
    return cookies[COOKIE_NAME];
  }
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) {
      return bearer;
    }
  }
  return null;
}

async function getAuthenticatedContext(req: Request): Promise<{
  user: SafeUser;
  session: {sid: string; idHash: string; rememberMe: boolean; expiresAt: number};
} | null> {
  const token = extractRequestSessionToken(req);
  if (!token) {
    return null;
  }
  const verified = verifySessionToken(token);
  if (!verified) {
    return null;
  }
  const idHash = hashSessionId(verified.sid);
  const store = await readStore();
  const activeSession = store.sessions.find(
    (s) => s.idHash === idHash && s.userId === verified.uid && s.expiresAt > Date.now(),
  );
  if (!activeSession) {
    return null;
  }
  const user = store.users.find((u) => u.id === verified.uid);
  if (!user) {
    return null;
  }
  return {
    user: sanitizeUser(user),
    session: {
      sid: verified.sid,
      idHash,
      rememberMe: activeSession.rememberMe,
      expiresAt: activeSession.expiresAt,
    },
  };
}

async function getAuthenticatedUser(req: Request): Promise<SafeUser | null> {
  const ctx = await getAuthenticatedContext(req);
  return ctx ? ctx.user : null;
}

function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function sendEmailIfConfigured(options: {
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
}): Promise<{sent: boolean; configured: boolean}> {
  if (!isSmtpConfigured()) {
    return {sent: false, configured: false};
  }
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `VERTYLEX <${OFFICIAL_EMAIL}>`,
      to: options.to,
      replyTo: options.replyTo,
      subject: options.subject,
      text: options.text,
    });
    return {sent: true, configured: true};
  } catch (err) {
    console.error('SMTP delivery error:', err);
    return {sent: false, configured: true};
  }
}

function createReferenceId(prefix: string): string {
  const year = new Date().getFullYear();
  const code = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${year}-${code}`;
}

function getRequestOrigin(req: Request): string {
  if (process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL') {
    return process.env.APP_URL.replace(/\/$/, '');
  }
  const proto =
    typeof req.headers['x-forwarded-proto'] === 'string'
      ? req.headers['x-forwarded-proto']
      : req.protocol;
  return `${proto}://${req.get('host')}`;
}

function isWhatsAppApiConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_BUSINESS_PHONE_ID && process.env.WHATSAPP_BUSINESS_ACCESS_TOKEN,
  );
}

function getOfficialWhatsAppBaseUrl(): string | null {
  const url = process.env.WHATSAPP_BUSINESS_OFFICIAL_URL?.trim();
  if (!url) return null;
  if (url.startsWith('https://')) {
    return url;
  }
  return null;
}

function getPaymentStatus() {
  const paystackConfigured = Boolean(process.env.PAYSTACK_SECRET_KEY);
  const flwConfigured = Boolean(process.env.FLW_SECRET_KEY);
  const activeProvider: 'paystack' | 'flutterwave' | null = flwConfigured
    ? 'flutterwave'
    : paystackConfigured
      ? 'paystack'
      : null;

  return {
    activeProvider,
    providers: {
      paystack: {
        configured: paystackConfigured,
        name: 'Paystack',
        supportedCurrencies: ['NGN', 'USD', 'GHS', 'KES', 'ZAR'],
      },
      flutterwave: {
        configured: flwConfigured,
        name: 'Flutterwave',
        supportedCurrencies: ['NGN', 'USD', 'GBP', 'EUR', 'CAD', 'GHS', 'KES', 'ZAR'],
      },
    },
  };
}

let ratesCache: {
  fetchedAtMs: number;
  fetchedAt: string;
  rates: Record<string, number>;
  source: string;
} | null = null;

async function fetchLiveExchangeRates(): Promise<{
  ratesAvailable: boolean;
  base: string;
  rates: Record<string, number> | null;
  source?: string;
  fetchedAt?: string;
  error?: string;
}> {
  if (ratesCache && Date.now() - ratesCache.fetchedAtMs < RATES_CACHE_TTL_MS) {
    return {
      ratesAvailable: true,
      base: 'USD',
      rates: ratesCache.rates,
      source: ratesCache.source,
      fetchedAt: ratesCache.fetchedAt,
    };
  }

  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = (await response.json()) as {
      result?: string;
      rates?: Record<string, number>;
      time_last_update_utc?: string;
    };
    if (data.result !== 'success' || !data.rates) {
      throw new Error('Invalid exchange rate response.');
    }
    const allValidRates: Record<string, number> = {};
    for (const [code, rate] of Object.entries(data.rates)) {
      if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
        allValidRates[code.toUpperCase()] = rate;
      }
    }
    if (!allValidRates.USD) {
      allValidRates.USD = 1;
    }
    ratesCache = {
      fetchedAtMs: Date.now(),
      fetchedAt: data.time_last_update_utc || new Date().toISOString(),
      rates: allValidRates,
      source: 'ExchangeRate-API (open.er-api.com)',
    };
    return {
      ratesAvailable: true,
      base: 'USD',
      rates: allValidRates,
      source: ratesCache.source,
      fetchedAt: ratesCache.fetchedAt,
    };
  } catch (err) {
    console.error('Exchange rate fetch failed:', err);
    if (ratesCache) {
      return {
        ratesAvailable: true,
        base: 'USD',
        rates: ratesCache.rates,
        source: ratesCache.source,
        fetchedAt: ratesCache.fetchedAt,
      };
    }
    return {
      ratesAvailable: false,
      base: 'USD',
      rates: null,
      error: 'Live exchange rates are temporarily unavailable.',
    };
  }
}

const VALID_ASSISTANT_ROUTES = new Map<string, string>([
  ['/services', 'Explore All Services'],
  ['/services/business-development', 'Business Development'],
  ['/services/advertising-and-promotion', 'Advertising & Promotion'],
  ['/services/graphic-design', 'Graphic Design & Flyers'],
  ['/services/website-development', 'Website Development'],
  ['/services/website-development#build-website', 'Build My Website'],
  ['/services/application-development', 'Application Development'],
  ['/services/branding-and-growth', 'Branding & Growth'],
  ['/business-solutions', 'Business Solutions'],
  ['/how-it-works', 'How It Works'],
  ['/submit-project', 'Start Your Project'],
  ['/login?reason=project&redirect=%2Fsubmit-project', 'Sign In to Start Project'],
  ['/register?reason=project&redirect=%2Fsubmit-project', 'Create Account'],
  ['/account', 'Customer Dashboard'],
  ['/contact', 'Contact VERTYLEX'],
]);

let primaryAssistantCooldownUntil = 0;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 25000,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function buildAssistantSystemInstruction(context?: {
  userName?: string | null;
  countryName?: string | null;
  regionName?: string;
  currencyCode?: string;
  whatsappActive?: boolean;
}): string {
  const firstName = context?.userName ? context.userName.trim().split(/\s+/)[0] : null;

  return [
    'You are VERTYLEX Assistant, a warm, natural, human-friendly customer support representative for VERTYLEX — a digital creative and business development company.',
    'Style & Personality:',
    '- Sound genuinely helpful, conversational, clear, and polite — like a knowledgeable human specialist, never robotic or repetitive.',
    '- Use plain, everyday language that ordinary customers immediately understand.',
    '- Do NOT repeat the opening welcome greeting on follow-up replies; answer directly and naturally.',
    '- Ask 1–2 concise clarifying follow-up questions when a customer is unsure what they need or has a broad goal (for example: what kind of business they are starting, whether they already have a logo/brand, or what features their website or app needs).',
    '- NEVER invent fixed final service quotes, timelines, fake completed projects, client numbers, or company awards. When asked about budgets or typical costs, share ONLY our official USD customer budget ranges below and explain that final quotations are prepared after reviewing the project brief.',
    '- Official Customer Budget Ranges (USD base, live-converted on each service page and project requirements form into the customer’s local currency):',
    '  * Flyer & Graphic Design: Minimum $50 USD, Recommended $80 USD, Maximum $900 USD.',
    '  * Website Development: Minimum $200 USD, Recommended $800 USD, Maximum $1,500 USD.',
    '  * Branding (Branding & Growth): Minimum $80 USD, Recommended $350 USD, Maximum $800 USD.',
    '  * Mobile App Development (Application Development): Minimum $100 USD, Recommended $190 USD, Maximum $700 USD.',
    '  * Business Development: Minimum $200 USD, Recommended $350 USD, Maximum $950 USD.',
    '  * Advertising (Advertising & Promotion): Minimum $70 USD, Recommended $190 USD, Maximum $600 USD.',
    '  * Other Digital Services / Custom Multi-Service Packages: scope-based quotations prepared after project review.',
    '- IMPORTANT: A customer’s selected budget is an intended spend estimate, not a confirmed price or automatic charge.',
    '- NEVER reveal or invent any personal phone number. VERTYLEX official email is vertylexvtylex@gmail.com.',
    context?.whatsappActive
      ? 'Official VERTYLEX WhatsApp Business support is active for customers who prefer continuing on WhatsApp.'
      : 'If a customer asks about WhatsApp support, explain clearly that official WhatsApp Business API support activates once the business channel credentials are finalized, and meanwhile they can continue chatting right here or click "Human Support" to escalate.',
    '',
    'Services & Exact Website Pages:',
    '1. Business Development (/services/business-development): turning new ideas into structured businesses, business planning, positioning, and identity setup ($200–$950 USD budget options, $350 USD recommended).',
    '2. Advertising & Promotion (/services/advertising-and-promotion): product advertisements, business advertisements, promotional campaigns, and social media marketing assets ($70–$600 USD budget options, $190 USD recommended).',
    '3. Graphic Design (/services/graphic-design): professional business flyers, event/product posters, promotional graphics, and social media visuals ($50–$900 USD budget options, $80 USD recommended).',
    '4. Website Development (/services/website-development or /services/website-development#build-website — "Give Your Business a Website of Its Own"): Business website, Online store / E-commerce website, Company website, Portfolio website, Personal website, Landing page, Custom website ($200–$1,500 USD budget options, $800 USD recommended).',
    '5. Application Development (/services/application-development): mobile applications, business applications, and custom software solutions ($100–$700 USD budget options, $190 USD recommended).',
    '6. Branding & Growth (/services/branding-and-growth): brand identity systems, visual consistency, online visibility, and ongoing growth support ($80–$800 USD budget options, $350 USD recommended).',
    '7. Business Solutions (/business-solutions) and How It Works (/how-it-works).',
    '- Customers also select a required requested delivery time during submission (Urgent: 1–2 days, Fast: 3–4 days, Standard: 5–7 days, or Flexible: 8–14 days), which is reviewed and confirmed by our team before production.',
    '',
    'Project Submission, Authentication, Quotations & Payments:',
    '- Browsing services and chatting with you is open to everyone.',
    '- Submitting a business idea, requesting a website/app, or sending a project enquiry requires signing in or creating a free client account.',
    context?.userName
      ? `- This customer IS signed in (Name: ${context.userName}, First Name: ${firstName}). Guide them directly to Start Your Project (/submit-project), Build My Website (/services/website-development#build-website), or their Customer Dashboard (/account) when ready.`
      : '- This visitor is NOT currently signed in. If they are ready to submit a project or request a website/service, clearly direct them to Sign In (/login?reason=project&redirect=%2Fsubmit-project) or Create Account (/register?reason=project&redirect=%2Fsubmit-project) so they are taken straight back to their project afterward.',
    '- Customers submit their project details BEFORE making any payment.',
    '- The VERTYLEX team reviews each brief and prepares a tailored USD quotation in their Customer Dashboard (/account).',
    '- Quotations and budget ranges are anchored in USD and converted live into the customer’s chosen local currency; any conversion or gateway processing fees are disclosed transparently before checkout.',
    '- Escalation: For complex requirements, urgent follow-up, or quotation questions needing a human specialist, invite the customer to click "Human Support" at the top of the chat or email vertylexvtylex@gmail.com.',
    context?.countryName
      ? `Customer location: ${context.countryName}.`
      : '',
    context?.regionName && context?.currencyCode
      ? `Active display currency: ${context.currencyCode} (${context.regionName}).`
      : '',
    '',
    'Response Format (JSON):',
    'Return a JSON object with:',
    '- "reply": A warm, clear, concise message (typically 2 short paragraphs or brief bullet points + a helpful next step or follow-up question). Do NOT include raw markdown URLs unless natural; use suggestedActions for clickable buttons.',
    '- "suggestedActions": 0 to 2 helpful navigation buttons choosing ONLY paths from this exact list:',
    '  /services, /services/business-development, /services/advertising-and-promotion, /services/graphic-design, /services/website-development, /services/website-development#build-website, /services/application-development, /services/branding-and-growth, /business-solutions, /how-it-works, /submit-project, /login?reason=project&redirect=%2Fsubmit-project, /register?reason=project&redirect=%2Fsubmit-project, /account, /contact',
  ]
    .filter(Boolean)
    .join('\n');
}

async function sendWhatsAppCloudMessage(to: string, bodyText: string): Promise<boolean> {
  const phoneId = process.env.WHATSAPP_BUSINESS_PHONE_ID;
  const accessToken = process.env.WHATSAPP_BUSINESS_ACCESS_TOKEN;
  if (!phoneId || !accessToken) {
    return false;
  }
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: {body: bodyText},
      }),
    });
    return res.ok;
  } catch (err) {
    console.error('WhatsApp Cloud API send error:', err);
    return false;
  }
}

async function startServer(): Promise<void> {
  await ensureOwnerAdminAccount();
  const app = express();
  app.set('trust proxy', 1);
  app.use(
    express.json({
      limit: '12mb',
      verify: (req, _res, buf) => {
        (req as Request & {rawBody?: Buffer}).rawBody = buf;
      },
    }),
  );

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({status: 'ok', smtpConfigured: isSmtpConfigured()});
  });

  app.get('/api/integrations/status', (_req: Request, res: Response) => {
    const officialUrl = getOfficialWhatsAppBaseUrl();
    const apiConnected = isWhatsAppApiConfigured();
    res.json({
      whatsapp: {
        configured: Boolean(apiConnected && officialUrl),
        apiConnected,
        officialUrl,
      },
      payments: getPaymentStatus(),
      assistant: {
        configured: Boolean(getGeminiClient()),
      },
      smtpConfigured: isSmtpConfigured(),
    });
  });

  app.get('/api/rates', async (_req: Request, res: Response) => {
    const result = await fetchLiveExchangeRates();
    res.json(result);
  });

  app.get('/api/region/suggest', (req: Request, res: Response) => {
    const countryHeader =
      (typeof req.headers['x-appengine-country'] === 'string' &&
        req.headers['x-appengine-country']) ||
      (typeof req.headers['cf-ipcountry'] === 'string' && req.headers['cf-ipcountry']) ||
      '';
    const cc = countryHeader.trim().toUpperCase();
    const euroCountries = new Set([
      'DE',
      'FR',
      'ES',
      'IT',
      'NL',
      'BE',
      'IE',
      'AT',
      'PT',
      'FI',
      'GR',
    ]);
    const directCountryMap = new Set([
      'NG',
      'US',
      'GB',
      'CA',
      'AU',
      'GH',
      'KE',
      'ZA',
      'IN',
      'AE',
      'SA',
      'SG',
      'JP',
      'KR',
      'CN',
      'CH',
      'SE',
      'PL',
      'MX',
      'BR',
      'NZ',
      'EG',
      'MA',
      'RW',
      'PH',
      'MY',
    ]);
    let suggestedCode: string | null = null;
    if (directCountryMap.has(cc)) {
      suggestedCode = cc;
    } else if (euroCountries.has(cc)) {
      suggestedCode = 'EU';
    }
    const suggestedCountryCode = /^[A-Z]{2}$/.test(cc) && cc !== 'ZZ' ? cc : null;
    res.json({suggestedCode, suggestedCountryCode});
  });

  // Authentication Routes
  app.get('/api/auth/me', async (req: Request, res: Response) => {
    const ctx = await getAuthenticatedContext(req);
    if (!ctx) {
      res.json({user: null, isAdmin: false, session: null});
      return;
    }

    let currentExpiresAt = ctx.session.expiresAt;
    if (ctx.session.rememberMe && currentExpiresAt - Date.now() < REMEMBER_ME_TTL_MS / 2) {
      const nextExpiresAt = Date.now() + REMEMBER_ME_TTL_MS;
      const renewed = await mutateStore((store) => {
        const entry = store.sessions.find((s) => s.idHash === ctx.session.idHash);
        if (!entry) return false;
        entry.expiresAt = nextExpiresAt;
        return true;
      });
      if (renewed) {
        currentExpiresAt = nextExpiresAt;
        const refreshedToken = signSessionToken({
          uid: ctx.user.id,
          sid: ctx.session.sid,
          rm: true,
          exp: nextExpiresAt,
        });
        setSessionCookie(req, res, refreshedToken, {
          rememberMe: true,
          ttlMs: REMEMBER_ME_TTL_MS,
        });
      }
    }

    res.json({
      user: ctx.user,
      isAdmin: isAdminUser(ctx.user),
      session: {
        rememberMe: ctx.session.rememberMe,
        expiresAt: currentExpiresAt,
      },
    });
  });

  app.post('/api/auth/register', async (req: Request, res: Response) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const emailRaw = typeof req.body?.email === 'string' ? req.body.email : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const rememberMe = req.body?.rememberMe === true;
    const email = normalizeEmail(emailRaw);
    const location = normalizeUserLocationInput(req.body);

    if (name.length < 2 || name.length > 100) {
      res.status(400).json({error: 'Please enter your full name (2 to 100 characters).'});
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({error: 'Please provide a valid email address.'});
      return;
    }
    if (password.length < 8 || password.length > 128) {
      res.status(400).json({error: 'Password must be between 8 and 128 characters.'});
      return;
    }

    if (isAuthorizedAdminEmail(email) || email === OFFICIAL_EMAIL) {
      res.status(403).json({
        error:
          'This email address is reserved for the pre-authorized VERTYLEX owner account and cannot be registered publicly.',
      });
      return;
    }

    try {
      const created = await mutateStore((store) => {
        const exists = store.users.some((u) => normalizeEmail(u.email) === email);
        if (exists) {
          return null;
        }
        const {salt, hash} = hashPassword(password);
        const user: StoredUser = {
          id: crypto.randomUUID(),
          name,
          email,
          role: 'customer',
          passwordSalt: salt,
          passwordHash: hash,
          ...(location.countryCode ? {countryCode: location.countryCode} : {}),
          ...(location.countryName ? {countryName: location.countryName} : {}),
          ...(location.stateRegion ? {stateRegion: location.stateRegion} : {}),
          ...(location.preferredCurrency ? {preferredCurrency: location.preferredCurrency} : {}),
          createdAt: new Date().toISOString(),
        };
        store.users.push(user);
        const session = createStoredSession(store, user.id, rememberMe);
        return {user, session};
      });

      if (!created) {
        res.status(409).json({error: 'An account with this email address already exists.'});
        return;
      }

      const safe = sanitizeUser(created.user);
      setSessionCookie(req, res, created.session.token, {
        rememberMe: created.session.rememberMe,
        ttlMs: created.session.ttlMs,
      });
      res.status(201).json({
        user: safe,
        isAdmin: isAdminUser(safe),
        session: {
          rememberMe: created.session.rememberMe,
          expiresAt: created.session.expiresAt,
        },
        sessionToken: created.session.token,
      });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({error: 'Unable to complete registration right now.'});
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const emailRaw = typeof req.body?.email === 'string' ? req.body.email : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const rememberMe = req.body?.rememberMe === true;
    const updateLocation = req.body?.updateLocation === true;
    const locationOverride = updateLocation ? normalizeUserLocationInput(req.body) : null;
    const email = normalizeEmail(emailRaw);

    if (!isValidEmail(email) || !password) {
      res.status(400).json({error: 'Please enter both your email address and password.'});
      return;
    }

    const store = await readStore();
    const user = store.users.find((u) => u.email === email);
    if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      res.status(401).json({error: 'Invalid email address or password.'});
      return;
    }

    const result = await mutateStore((draft) => {
      const targetUser = draft.users.find((u) => u.id === user.id);
      if (
        targetUser &&
        locationOverride &&
        (locationOverride.countryCode || locationOverride.countryName)
      ) {
        if (locationOverride.countryCode) targetUser.countryCode = locationOverride.countryCode;
        if (locationOverride.countryName) targetUser.countryName = locationOverride.countryName;
        if (locationOverride.stateRegion) {
          targetUser.stateRegion = locationOverride.stateRegion;
        } else {
          delete targetUser.stateRegion;
        }
        if (locationOverride.preferredCurrency) {
          targetUser.preferredCurrency = locationOverride.preferredCurrency;
        }
      }
      const session = createStoredSession(draft, user.id, rememberMe);
      return {
        user: targetUser || user,
        session,
      };
    });

    const safe = sanitizeUser(result.user);
    setSessionCookie(req, res, result.session.token, {
      rememberMe: result.session.rememberMe,
      ttlMs: result.session.ttlMs,
    });
    res.json({
      user: safe,
      isAdmin: isAdminUser(safe),
      session: {
        rememberMe: result.session.rememberMe,
        expiresAt: result.session.expiresAt,
      },
      sessionToken: result.session.token,
    });
  });

  app.patch('/api/auth/preferences', async (req: Request, res: Response) => {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      res.status(401).json({error: 'Please sign in to update your account preferences.'});
      return;
    }

    const location = normalizeUserLocationInput(req.body);
    if (!location.countryCode || !location.countryName) {
      res.status(400).json({error: 'Please select a valid country for your account profile.'});
      return;
    }

    const updatedUser = await mutateStore((store) => {
      const target = store.users.find((u) => u.id === authUser.id);
      if (!target) return null;
      target.countryCode = location.countryCode;
      target.countryName = location.countryName;
      if (location.stateRegion) {
        target.stateRegion = location.stateRegion;
      } else {
        delete target.stateRegion;
      }
      if (location.preferredCurrency) {
        target.preferredCurrency = location.preferredCurrency;
      }
      return sanitizeUser(target);
    });

    if (!updatedUser) {
      res.status(404).json({error: 'Account record not found.'});
      return;
    }

    res.json({user: updatedUser});
  });

  app.post('/api/auth/logout', async (req: Request, res: Response) => {
    const token = extractRequestSessionToken(req);
    if (token) {
      const verified = verifySessionToken(token);
      if (verified) {
        const idHash = hashSessionId(verified.sid);
        await mutateStore((store) => {
          store.sessions = store.sessions.filter(
            (s) => s.idHash !== idHash && s.expiresAt > Date.now(),
          );
        });
      }
    }
    clearSessionCookie(req, res);
    res.json({ok: true});
  });

  app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
    const emailRaw = typeof req.body?.email === 'string' ? req.body.email : '';
    const email = normalizeEmail(emailRaw);

    if (!isValidEmail(email)) {
      res.status(400).json({error: 'Please enter a valid email address.'});
      return;
    }

    if (!isSmtpConfigured()) {
      res.status(503).json({
        emailConfigured: false,
        error:
          'Automated password reset email delivery is not configured on this server yet. Please contact VERTYLEX support at vertylexvtylex@gmail.com or open VERTYLEX Assistant for assistance.',
      });
      return;
    }

    const store = await readStore();
    const user = store.users.find((u) => u.email === email);

    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      await mutateStore((draft) => {
        draft.resetTokens = draft.resetTokens.filter(
          (t) => t.userId !== user.id && t.expiresAt > Date.now(),
        );
        draft.resetTokens.push({
          tokenHash,
          userId: user.id,
          email: user.email,
          expiresAt: Date.now() + 1000 * 60 * 30,
          used: false,
        });
      });

      const resetUrl = `${getRequestOrigin(req)}/reset-password?token=${rawToken}`;
      await sendEmailIfConfigured({
        to: user.email,
        subject: 'VERTYLEX Password Reset Request',
        text: `Hello ${user.name},\n\nWe received a request to reset your VERTYLEX account password. Use the link below within 30 minutes:\n\n${resetUrl}\n\nIf you did not request this, you can safely ignore this message.\n\nVERTYLEX\n${OFFICIAL_EMAIL}`,
      });
    }

    res.json({
      ok: true,
      emailConfigured: true,
      message:
        'If an account exists for that email address, a password reset link has been sent.',
    });
  });

  app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const newPassword = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!token) {
      res.status(400).json({error: 'Reset token is missing.'});
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      res.status(400).json({error: 'New password must be between 8 and 128 characters.'});
      return;
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const updated = await mutateStore((store) => {
      const entry = store.resetTokens.find(
        (t) => t.tokenHash === tokenHash && !t.used && t.expiresAt > Date.now(),
      );
      if (!entry) {
        return false;
      }
      const user = store.users.find((u) => u.id === entry.userId);
      if (!user) {
        return false;
      }
      const {salt, hash} = hashPassword(newPassword);
      user.passwordSalt = salt;
      user.passwordHash = hash;
      entry.used = true;
      store.sessions = store.sessions.filter((s) => s.userId !== user.id);
      return true;
    });

    if (!updated) {
      res.status(400).json({error: 'This password reset link is invalid or has expired.'});
      return;
    }

    clearSessionCookie(req, res);
    res.json({ok: true, message: 'Your password has been updated. You can now sign in.'});
  });

  // VERTYLEX Assistant (Server-Side Gemini API)
  app.post('/api/assistant/chat', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    const messagesRaw = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const regionName = typeof req.body?.regionName === 'string' ? req.body.regionName : undefined;
    const currencyCode =
      typeof req.body?.currencyCode === 'string' ? req.body.currencyCode : undefined;

    const cleanMessages = messagesRaw
      .filter(
        (m: unknown): m is {role: 'user' | 'model'; text: string} =>
          Boolean(m) &&
          typeof m === 'object' &&
          ((m as {role?: string}).role === 'user' || (m as {role?: string}).role === 'model') &&
          typeof (m as {text?: string}).text === 'string' &&
          (m as {text: string}).text.trim().length > 0,
      )
      .slice(-16);

    if (cleanMessages.length === 0) {
      res.status(400).json({error: 'Please enter a message for VERTYLEX Assistant.'});
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'VERTYLEX Assistant AI service is not configured yet. Please use Human Support or email vertylexvtylex@gmail.com.',
      });
      return;
    }

    const contents = cleanMessages.map((m: {role: 'user' | 'model'; text: string}) => ({
      role: m.role,
      parts: [{text: m.text.slice(0, 2000)}],
    }));

    const systemInstruction = buildAssistantSystemInstruction({
      userName: user?.name || null,
      countryName: user?.countryName || null,
      regionName,
      currencyCode: user?.preferredCurrency || currencyCode,
      whatsappActive: Boolean(isWhatsAppApiConfigured() && getOfficialWhatsAppBaseUrl()),
    });

    const primaryConfig = {
      systemInstruction,
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.LOW,
      },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          reply: {
            type: Type.STRING,
            description: 'Warm, helpful, conversational customer support message.',
          },
          suggestedActions: {
            type: Type.ARRAY,
            description: '0 to 2 relevant VERTYLEX page navigation links for the customer.',
            items: {
              type: Type.OBJECT,
              properties: {
                label: {
                  type: Type.STRING,
                  description: 'Short button label such as Explore Website Development.',
                },
                path: {
                  type: Type.STRING,
                  description: 'Valid VERTYLEX route path.',
                },
              },
              required: ['label', 'path'],
            },
          },
        },
        required: ['reply'],
      },
    };

    try {
      let response;
      const now = Date.now();
      const usePrimary = now >= primaryAssistantCooldownUntil;
      if (usePrimary) {
        try {
          response = await ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents,
            config: {
              ...primaryConfig,
              abortSignal: AbortSignal.timeout(5000),
            },
          });
        } catch (primaryErr) {
          const primaryStatus =
            typeof (primaryErr as {status?: unknown})?.status === 'number'
              ? (primaryErr as {status: number}).status
              : null;
          const primaryName = (primaryErr as {name?: unknown})?.name;
          if (primaryStatus === 400 || primaryStatus === 403 || primaryStatus === 429) {
            throw primaryErr;
          }
          primaryAssistantCooldownUntil = Date.now() + 1000 * 60 * 5;
          console.warn('Primary assistant model slow/unavailable, routing to gemini-3.1-flash-lite:', {
            status: primaryStatus,
            name: primaryName,
          });
          response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents,
            config: {
              ...primaryConfig,
              thinkingConfig: {
                thinkingLevel: ThinkingLevel.MINIMAL,
              },
              abortSignal: AbortSignal.timeout(12000),
            },
          });
        }
      } else {
        response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents,
          config: {
            ...primaryConfig,
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.MINIMAL,
            },
            abortSignal: AbortSignal.timeout(12000),
          },
        });
      }

      const rawText = response.text?.trim() || '';
      if (!rawText) {
        throw new Error('Empty response from assistant model.');
      }

      let reply = rawText;
      let suggestedActions: Array<{label: string; path: string}> = [];

      try {
        const parsed = JSON.parse(rawText) as {
          reply?: unknown;
          suggestedActions?: unknown;
        };
        if (typeof parsed.reply === 'string' && parsed.reply.trim()) {
          reply = parsed.reply.trim();
        }
        if (Array.isArray(parsed.suggestedActions)) {
          suggestedActions = parsed.suggestedActions
            .filter(
              (a): a is {label: string; path: string} =>
                Boolean(a) &&
                typeof a === 'object' &&
                typeof (a as {label?: unknown}).label === 'string' &&
                typeof (a as {path?: unknown}).path === 'string' &&
                VALID_ASSISTANT_ROUTES.has((a as {path: string}).path),
            )
            .slice(0, 2)
            .map((a) => ({
              label: a.label.trim().slice(0, 48) || VALID_ASSISTANT_ROUTES.get(a.path) || 'View',
              path: a.path,
            }));
        }
      } catch {
        // If response was plain text instead of JSON, serve rawText cleanly
        reply = rawText;
      }

      res.json({reply, suggestedActions});
    } catch (err) {
      const errObj = err as {
        name?: unknown;
        status?: unknown;
        message?: unknown;
        code?: unknown;
        cause?: {code?: unknown; message?: unknown; errno?: unknown} | unknown;
      };
      const causeObj =
        errObj?.cause && typeof errObj.cause === 'object'
          ? (errObj.cause as {code?: unknown; message?: unknown; errno?: unknown})
          : null;
      console.error('Assistant error:', {
        name: errObj?.name,
        status: errObj?.status,
        code: errObj?.code,
        message: typeof errObj?.message === 'string' ? errObj.message.slice(0, 200) : undefined,
        causeCode: causeObj?.code,
      });
      const errStatus = typeof errObj?.status === 'number' ? errObj.status : 502;
      if (errStatus === 400 || errStatus === 403) {
        res.status(503).json({
          error:
            'VERTYLEX Assistant AI service is awaiting a valid API key in Settings > Secrets. Please use Human Support or email vertylexvtylex@gmail.com.',
        });
        return;
      }
      if (errStatus === 404) {
        res.status(502).json({
          error:
            'VERTYLEX Assistant model endpoint could not be reached. Please try again or reach Human Support.',
        });
        return;
      }
      if (errStatus === 429) {
        res.status(429).json({
          error:
            'VERTYLEX Assistant is temporarily busy due to request limits. Please try again shortly or reach Human Support.',
        });
        return;
      }
      res.status(502).json({
        error:
          'Unable to reach VERTYLEX Assistant right now. Please try again in a moment or escalate to Human Support.',
      });
    }
  });

  // Human Support Escalation Route
  app.post('/api/support/escalate', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    const name =
      (typeof req.body?.name === 'string' ? req.body.name.trim() : '') || user?.name || '';
    const emailRaw =
      (typeof req.body?.email === 'string' ? req.body.email : '') || user?.email || '';
    const email = normalizeEmail(emailRaw);
    const topic = typeof req.body?.topic === 'string' ? req.body.topic.trim() : 'Support Escalation';
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const conversationSummary =
      typeof req.body?.conversationSummary === 'string'
        ? req.body.conversationSummary.trim().slice(0, 3000)
        : '';

    if (name.length < 2 || name.length > 120) {
      res.status(400).json({error: 'Please enter your name.'});
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({error: 'Please enter a valid email address so our team can reply.'});
      return;
    }
    if (message.length < 10 || message.length > 4000) {
      res.status(400).json({error: 'Please briefly describe how our team can assist you.'});
      return;
    }

    const ticket: StoredSupportTicket = {
      id: crypto.randomUUID(),
      referenceId: createReferenceId('SUP'),
      userId: user ? user.id : null,
      name,
      email,
      topic: topic.slice(0, 140),
      message,
      conversationSummary,
      channel: 'web',
      status: 'Escalated to Human Support',
      createdAt: new Date().toISOString(),
    };

    await mutateStore((store) => {
      store.supportTickets.push(ticket);
    });

    const emailResult = await sendEmailIfConfigured({
      to: OFFICIAL_EMAIL,
      replyTo: email,
      subject: `[VERTYLEX Support Escalation ${ticket.referenceId}] ${ticket.topic}`,
      text: [
        `Ticket Reference: ${ticket.referenceId}`,
        `Customer: ${name} <${email}>`,
        user ? `Account ID: ${user.id}` : 'Account: Visitor',
        '',
        'Enquiry:',
        message,
        conversationSummary ? `\nAssistant Context:\n${conversationSummary}` : '',
      ].join('\n'),
    });

    res.status(201).json({
      ticket,
      emailDelivered: emailResult.sent,
    });
  });

  // Official WhatsApp Business Cloud API Webhook
  app.get('/api/whatsapp/webhook', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const expectedToken = process.env.WHATSAPP_BUSINESS_VERIFY_TOKEN;

    if (mode === 'subscribe' && expectedToken && token === expectedToken) {
      res.status(200).send(challenge);
      return;
    }
    res.sendStatus(403);
  });

  app.post('/api/whatsapp/webhook', async (req: Request, res: Response) => {
    if (!isWhatsAppApiConfigured()) {
      res.status(503).json({error: 'WhatsApp Business Platform API credentials not configured.'});
      return;
    }

    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const incomingMsg = change?.messages?.[0];

    if (incomingMsg && incomingMsg.type === 'text' && incomingMsg.from && incomingMsg.text?.body) {
      const senderWaId = String(incomingMsg.from);
      const userText = String(incomingMsg.text.body).trim();
      const wantsHuman = /\b(human|agent|person|representative|support team|escalate)\b/i.test(
        userText,
      );

      if (wantsHuman) {
        const ticket: StoredSupportTicket = {
          id: crypto.randomUUID(),
          referenceId: createReferenceId('SUP'),
          userId: null,
          name: change?.contacts?.[0]?.profile?.name || 'WhatsApp Customer',
          email: 'whatsapp-channel@vertylex.pending',
          topic: 'WhatsApp Human Handover',
          message: userText,
          conversationSummary: `WhatsApp sender ID: ${senderWaId}`,
          channel: 'whatsapp',
          status: 'Escalated to Human Support',
          createdAt: new Date().toISOString(),
        };
        await mutateStore((store) => {
          store.supportTickets.push(ticket);
        });
        await sendWhatsAppCloudMessage(
          senderWaId,
          `Your request has been escalated to a VERTYLEX human specialist (Reference: ${ticket.referenceId}). You may also reach us at ${OFFICIAL_EMAIL}.`,
        );
      } else {
        const ai = getGeminiClient();
        if (ai) {
          try {
            const response = await ai.models.generateContent({
              model: 'gemini-4-hydrogen',
              contents: userText,
              config: {
                systemInstruction: buildAssistantSystemInstruction({whatsappActive: true}),
              },
            });
            if (response.text) {
              await sendWhatsAppCloudMessage(senderWaId, response.text.trim());
            }
          } catch (err) {
            console.error('WhatsApp AI reply failed:', err);
          }
        }
      }
    }

    res.sendStatus(200);
  });

  // Project Submission Routes (Protected)
  app.get('/api/projects', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({error: 'Authentication required to view submitted projects.'});
      return;
    }
    const store = await readStore();
    const userProjects = store.projects
      .filter((p) => p.userId === user.id)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((p) => sanitizeProjectForCustomer(p));
    res.json({projects: userProjects});
  });

  app.get('/api/projects/:id', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({error: 'Authentication required.'});
      return;
    }
    const store = await readStore();
    const admin = isAdminUser(user);
    const project = store.projects.find(
      (p) => p.id === req.params.id && (p.userId === user.id || admin),
    );
    if (!project) {
      res.status(404).json({error: 'Project not found.'});
      return;
    }
    res.json({project: admin ? project : sanitizeProjectForCustomer(project)});
  });

  app.get('/api/projects/:id/attachments/:attachmentId', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({error: 'Authentication required.'});
      return;
    }
    const store = await readStore();
    const project = store.projects.find(
      (p) => p.id === req.params.id && (p.userId === user.id || isAdminUser(user)),
    );
    if (!project) {
      res.status(404).json({error: 'Project not found.'});
      return;
    }
    const attachment = (project.attachments || []).find((a) => a.id === req.params.attachmentId);
    if (!attachment) {
      res.status(404).json({error: 'Attachment not found.'});
      return;
    }
    const filePath = path.join(UPLOADS_DIR, project.id, path.basename(attachment.storedName));
    if (!fs.existsSync(filePath)) {
      res.status(404).json({error: 'Attachment file is unavailable.'});
      return;
    }
    const safeFilename = attachment.originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.sendFile(filePath);
  });

  app.post('/api/projects', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({
        error: 'Please sign in or create an account to continue with your project.',
      });
      return;
    }

    const fullName =
      (typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '') || user.name;
    const email = normalizeEmail(user.email);
    const businessName =
      typeof req.body?.businessName === 'string' ? req.body.businessName.trim() : '';
    const selectedService =
      typeof req.body?.selectedService === 'string' ? req.body.selectedService.trim() : '';
    const projectTitle =
      typeof req.body?.projectTitle === 'string' ? req.body.projectTitle.trim() : '';
    const ideaDescription =
      typeof req.body?.ideaDescription === 'string' ? req.body.ideaDescription.trim() : '';
    let budgetRange =
      typeof req.body?.budgetRange === 'string' ? req.body.budgetRange.trim() : '';
    const rawBudgetUsd = req.body?.budgetUsd;
    const budgetRule = getServiceBudgetRule(selectedService);
    let budgetUsd: number | undefined;
    if (rawBudgetUsd !== undefined && rawBudgetUsd !== null && rawBudgetUsd !== '') {
      const parsedUsd = Number(rawBudgetUsd);
      if (!Number.isFinite(parsedUsd) || parsedUsd <= 0) {
        res.status(400).json({error: 'Customer budget must be a valid positive USD amount.'});
        return;
      }
      if (budgetRule && (parsedUsd < budgetRule.minUsd || parsedUsd > budgetRule.maxUsd)) {
        res.status(400).json({
          error: `${selectedService} budget must be between $${budgetRule.minUsd.toLocaleString()} and $${budgetRule.maxUsd.toLocaleString()} USD.`,
        });
        return;
      }
      budgetUsd = Math.round(parsedUsd * 100) / 100;
      if (!budgetRange) {
        budgetRange =
          budgetRule && budgetUsd === budgetRule.recommendedUsd
            ? `$${budgetUsd.toLocaleString()} USD (Recommended)`
            : `$${budgetUsd.toLocaleString()} USD (Customer Budget Estimate)`;
      }
    }
    const additionalRequirements =
      typeof req.body?.additionalRequirements === 'string'
        ? req.body.additionalRequirements.trim()
        : '';
    const preferredRegion =
      typeof req.body?.preferredRegion === 'string'
        ? req.body.preferredRegion.trim()
        : user.countryName
          ? user.stateRegion
            ? `${user.countryName} (${user.stateRegion})`
            : user.countryName
          : '';
    const preferredCurrency =
      typeof req.body?.preferredCurrency === 'string' &&
      ALLOWED_CURRENCY_CODES.has(req.body.preferredCurrency.trim().toUpperCase())
        ? req.body.preferredCurrency.trim().toUpperCase()
        : user.preferredCurrency || 'USD';
    const countryCode =
      (typeof req.body?.countryCode === 'string' ? req.body.countryCode.trim().toUpperCase() : '') ||
      user.countryCode;
    const countryName =
      (typeof req.body?.countryName === 'string' ? req.body.countryName.trim() : '') ||
      user.countryName;
    const stateRegion =
      (typeof req.body?.stateRegion === 'string' ? req.body.stateRegion.trim() : '') ||
      user.stateRegion;
    const idempotencyKey =
      typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey.trim().slice(0, 100) : '';

    // Parse & sanitize structured service-specific requirements
    const rawServiceDetails =
      req.body?.serviceDetails && typeof req.body.serviceDetails === 'object'
        ? (req.body.serviceDetails as Record<string, unknown>)
        : {};
    const serviceDetails: Record<string, string | string[]> = {};
    for (const [key, val] of Object.entries(rawServiceDetails)) {
      const cleanKey = key.trim().slice(0, 80);
      if (!cleanKey) continue;
      if (typeof val === 'string') {
        const trimmed = val.trim().slice(0, 2000);
        if (trimmed) serviceDetails[cleanKey] = trimmed;
      } else if (Array.isArray(val)) {
        const items = val
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .map((item) => item.trim().slice(0, 200))
          .slice(0, 25);
        if (items.length > 0) serviceDetails[cleanKey] = items;
      }
    }

    const rawDeliveryTime =
      typeof req.body?.deliveryTime === 'string'
        ? req.body.deliveryTime.trim()
        : typeof serviceDetails.deliveryTime === 'string'
          ? serviceDetails.deliveryTime.trim()
          : '';
    const deliveryTime = rawDeliveryTime.replace(/\s*-\s*/g, '–');

    if (fullName.length < 2 || fullName.length > 120) {
      res.status(400).json({error: 'Please enter your full name.'});
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({error: 'Please enter a valid email address.'});
      return;
    }
    if (!selectedService) {
      res.status(400).json({error: 'Please select a service category.'});
      return;
    }
    if (projectTitle.length < 3 || projectTitle.length > 160) {
      res.status(400).json({error: 'Please provide a clear project title.'});
      return;
    }
    if (ideaDescription.length < 20 || ideaDescription.length > 8000) {
      res.status(400).json({
        error: 'Please describe your project requirements in at least 20 characters so VERTYLEX can review them properly.',
      });
      return;
    }
    if (!ALLOWED_DELIVERY_TIMES.has(deliveryTime)) {
      res.status(400).json({
        error:
          'Please select your requested delivery time (Urgent: 1–2 days, Fast: 3–4 days, Standard: 5–7 days, or Flexible: 8–14 days).',
      });
      return;
    }

    // Check idempotency key to prevent duplicate submissions
    if (idempotencyKey) {
      const existingStore = await readStore();
      const duplicate = existingStore.projects.find(
        (p) => p.userId === user.id && p.idempotencyKey === idempotencyKey,
      );
      if (duplicate) {
        res.status(200).json({
          project: sanitizeProjectForCustomer(duplicate),
          emailDelivered: false,
          smtpConfigured: isSmtpConfigured(),
          deduplicated: true,
        });
        return;
      }
    }

    // Validate optional attachments (up to 4 files, max 2MB each)
    const ALLOWED_ATTACHMENT_TYPES = new Map<string, string>([
      ['image/png', '.png'],
      ['image/jpeg', '.jpg'],
      ['image/webp', '.webp'],
      ['application/pdf', '.pdf'],
      ['text/plain', '.txt'],
      ['application/msword', '.doc'],
      ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
    ]);

    const rawAttachments = Array.isArray(req.body?.attachments) ? req.body.attachments : [];
    if (rawAttachments.length > 4) {
      res.status(400).json({error: 'You can attach up to 4 files per project submission.'});
      return;
    }

    const preparedFiles: {
      meta: StoredAttachment;
      buffer: Buffer;
    }[] = [];

    const projectId = crypto.randomUUID();
    let totalBytes = 0;

    for (const item of rawAttachments) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as {name?: unknown; mimeType?: unknown; dataBase64?: unknown};
      const origName = typeof obj.name === 'string' ? obj.name.trim().slice(0, 140) : 'attachment';
      const mimeType = typeof obj.mimeType === 'string' ? obj.mimeType.trim().toLowerCase() : '';
      const dataBase64 = typeof obj.dataBase64 === 'string' ? obj.dataBase64.trim() : '';

      const ext = ALLOWED_ATTACHMENT_TYPES.get(mimeType);
      if (!ext) {
        res.status(400).json({
          error: `Unsupported file type for "${origName}". Supported formats: PNG, JPG, WEBP, PDF, DOC, DOCX, TXT.`,
        });
        return;
      }
      const cleanBase64 = dataBase64.includes(',') ? dataBase64.split(',').pop() || '' : dataBase64;
      const buffer = Buffer.from(cleanBase64, 'base64');
      if (buffer.length === 0 || buffer.length > 2 * 1024 * 1024) {
        res.status(400).json({
          error: `Attachment "${origName}" must be non-empty and under 2 MB.`,
        });
        return;
      }
      totalBytes += buffer.length;
      if (totalBytes > 6 * 1024 * 1024) {
        res.status(400).json({error: 'Combined attachment size must be under 6 MB.'});
        return;
      }
      const attId = crypto.randomUUID();
      preparedFiles.push({
        meta: {
          id: attId,
          originalName: origName,
          mimeType,
          size: buffer.length,
          storedName: `${attId}${ext}`,
          uploadedAt: new Date().toISOString(),
        },
        buffer,
      });
    }

    if (preparedFiles.length > 0) {
      const projectUploadDir = path.join(UPLOADS_DIR, projectId);
      await fsp.mkdir(projectUploadDir, {recursive: true});
      for (const file of preparedFiles) {
        await fsp.writeFile(path.join(projectUploadDir, file.meta.storedName), file.buffer);
      }
    }

    let budgetEstimatedLocalAmount: number | undefined;
    let budgetExchangeRateAtSubmit: number | undefined;
    if (typeof budgetUsd === 'number') {
      if (preferredCurrency === 'USD') {
        budgetEstimatedLocalAmount = budgetUsd;
        budgetExchangeRateAtSubmit = 1;
      } else {
        const ratesRes = await fetchLiveExchangeRates();
        if (
          ratesRes.ratesAvailable &&
          ratesRes.rates &&
          typeof ratesRes.rates[preferredCurrency] === 'number'
        ) {
          budgetExchangeRateAtSubmit = ratesRes.rates[preferredCurrency];
          budgetEstimatedLocalAmount =
            Math.round(budgetUsd * budgetExchangeRateAtSubmit * 100) / 100;
        }
      }
    }

    const nowIso = new Date().toISOString();
    const project: StoredProject = {
      id: projectId,
      referenceId: createReferenceId('VTX'),
      userId: user.id,
      fullName,
      email,
      ...(countryCode ? {countryCode} : {}),
      ...(countryName ? {countryName} : {}),
      ...(stateRegion ? {stateRegion} : {}),
      businessName,
      selectedService,
      projectTitle,
      ideaDescription,
      budgetRange,
      ...(typeof budgetUsd === 'number' ? {budgetUsd} : {}),
      ...(budgetRule
        ? {
            recommendedBudgetUsd: budgetRule.recommendedUsd,
            budgetMinUsd: budgetRule.minUsd,
            budgetMaxUsd: budgetRule.maxUsd,
          }
        : {}),
      ...(typeof budgetUsd === 'number' ? {budgetDisplayCurrency: preferredCurrency} : {}),
      ...(typeof budgetEstimatedLocalAmount === 'number' ? {budgetEstimatedLocalAmount} : {}),
      ...(typeof budgetExchangeRateAtSubmit === 'number' ? {budgetExchangeRateAtSubmit} : {}),
      deliveryTime,
      deliveryTimeStatus: 'Pending Review',
      additionalRequirements,
      serviceDetails,
      attachments: preparedFiles.map((f) => f.meta),
      idempotencyKey: idempotencyKey || undefined,
      progressStage: 'New Request',
      preferredRegion,
      preferredCurrency,
      status: 'New Request',
      quotation: null,
      internalNotes: [],
      updates: [],
      auditLog: [
        {
          id: crypto.randomUUID(),
          actorEmail: user.email,
          actorRole: 'customer',
          action: 'Project Submitted',
          details:
            typeof budgetUsd === 'number'
              ? `Submitted ${selectedService} request (Budget: $${budgetUsd.toLocaleString()} USD · Delivery: ${deliveryTime})`
              : `Submitted ${selectedService} request (Delivery: ${deliveryTime})`,
          createdAt: nowIso,
        },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const origin = getRequestOrigin(req);
    const adminProjectUrl = `${origin}/admin?project=${project.id}`;

    const formattedServiceDetails = Object.entries(serviceDetails)
      .map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('\n');

    const emailResult = await sendEmailIfConfigured({
      to: OFFICIAL_EMAIL,
      replyTo: email,
      subject: `[VERTYLEX New Project ${project.referenceId}] ${projectTitle} — ${selectedService}`,
      text: [
        `New customer project request received on VERTYLEX.`,
        '',
        `Reference Number: ${project.referenceId}`,
        `Server Submission Timestamp: ${project.createdAt}`,
        `Customer Name: ${fullName}`,
        `Customer Email: ${email}`,
        `Country & Region: ${countryName || preferredRegion || 'Not specified'}${stateRegion ? ` (${stateRegion})` : ''}`,
        `Display Currency: ${preferredCurrency || 'USD'}`,
        `Business Name: ${businessName || 'Not specified'}`,
        `Selected Service: ${selectedService}`,
        `Project Title: ${projectTitle}`,
        `Requested Delivery Time: ${deliveryTime} (Pending administrator confirmation)`,
        `Customer Intended Budget (USD): ${typeof budgetUsd === 'number' ? `$${budgetUsd.toLocaleString()} USD` : budgetRange || 'Not specified'}`,
        typeof budgetEstimatedLocalAmount === 'number'
          ? `Local Currency Equivalent (${preferredCurrency}): ${budgetEstimatedLocalAmount.toLocaleString()} ${preferredCurrency}`
          : '',
        budgetRule ? `Recommended Budget: $${budgetRule.recommendedUsd.toLocaleString()} USD` : '',
        '',
        'Full Project Description:',
        ideaDescription,
        formattedServiceDetails ? `\nService-Specific Details:\n${formattedServiceDetails}` : '',
        '',
        'Additional Requirements:',
        additionalRequirements || 'None specified',
        preparedFiles.length > 0
          ? `\nAttached Files (${preparedFiles.length}): ${preparedFiles.map((f) => f.meta.originalName).join(', ')}`
          : '',
        '',
        `Open in Private Admin Dashboard: ${adminProjectUrl}`,
      ]
        .filter(Boolean)
        .join('\n'),
    });

    await mutateStore((store) => {
      store.projects.push(project);
      pushStoreNotification(store, {
        recipientRole: 'admin',
        recipientUserId: null,
        projectId: project.id,
        projectReferenceId: project.referenceId,
        type: 'new_project',
        title: `New Project Request · ${project.referenceId}`,
        message: `${fullName} submitted "${projectTitle}" (${selectedService}).`,
        linkPath: `/admin?project=${project.id}`,
        emailSent: emailResult.sent,
      });
    });

    res.status(201).json({
      project: sanitizeProjectForCustomer(project),
      emailDelivered: emailResult.sent,
      smtpConfigured: emailResult.configured,
    });
  });

  app.post('/api/projects/:id/accept-quote', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({error: 'Authentication required.'});
      return;
    }

    const updated = await mutateStore((store) => {
      const project = store.projects.find(
        (p) => p.id === req.params.id && p.userId === user.id,
      );
      if (!project || !project.quotation) {
        return {status: 'not_found' as const, project: null};
      }
      if (
        project.status === 'Payment Confirmed' ||
        project.status === 'Paid' ||
        project.status === 'In Progress' ||
        project.status === 'Completed'
      ) {
        return {status: 'already_paid' as const, project};
      }
      if (project.status === 'Cancelled') {
        return {status: 'cancelled' as const, project};
      }
      const nowIso = new Date().toISOString();
      project.status = 'Awaiting Payment';
      project.progressStage = 'Awaiting Payment';
      project.updatedAt = nowIso;
      if (!project.quotation.acceptedAt) {
        project.quotation.acceptedAt = nowIso;
      }
      delete project.quotation.declinedAt;
      delete project.quotation.declineReason;
      appendAuditEntry(
        project,
        user.email,
        'customer',
        'Quotation Accepted',
        `Customer accepted quotation ($${project.quotation.amountUsd} USD).`,
      );
      pushStoreNotification(store, {
        recipientRole: 'admin',
        recipientUserId: null,
        projectId: project.id,
        projectReferenceId: project.referenceId,
        type: 'quotation_accepted',
        title: `Quotation Accepted · ${project.referenceId}`,
        message: `${project.fullName} accepted the quotation for "${project.projectTitle}" ($${project.quotation.amountUsd.toLocaleString()} USD).`,
        linkPath: `/admin?project=${project.id}`,
      });
      return {status: 'ok' as const, project};
    });

    if (updated.status === 'not_found' || !updated.project) {
      res.status(404).json({error: 'Project or quotation not found.'});
      return;
    }
    if (updated.status === 'cancelled') {
      res.status(400).json({error: 'Cancelled projects cannot be accepted.'});
      return;
    }

    if (updated.status === 'ok') {
      await sendEmailIfConfigured({
        to: OFFICIAL_EMAIL,
        replyTo: updated.project.email,
        subject: `[VERTYLEX Quotation Accepted ${updated.project.referenceId}] ${updated.project.projectTitle}`,
        text: `${updated.project.fullName} (${updated.project.email}) accepted the quotation for project ${updated.project.referenceId} (${updated.project.projectTitle}).\n\nView in Admin Dashboard: ${getRequestOrigin(req)}/admin?project=${updated.project.id}`,
      });
    }

    res.json({project: sanitizeProjectForCustomer(updated.project)});
  });

  app.post('/api/projects/:id/decline-quote', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({error: 'Authentication required.'});
      return;
    }
    const reason =
      typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 1000) : '';

    const updated = await mutateStore((store) => {
      const project = store.projects.find(
        (p) => p.id === req.params.id && p.userId === user.id,
      );
      if (!project || !project.quotation) {
        return {status: 'not_found' as const, project: null};
      }
      if (
        project.status === 'Payment Confirmed' ||
        project.status === 'Paid' ||
        project.status === 'In Progress' ||
        project.status === 'Completed'
      ) {
        return {status: 'already_paid' as const, project};
      }
      const nowIso = new Date().toISOString();
      project.quotation.declinedAt = nowIso;
      if (reason) {
        project.quotation.declineReason = reason;
      }
      project.status = 'Under Review';
      project.progressStage = 'Under Review';
      project.updatedAt = nowIso;
      if (!Array.isArray(project.updates)) {
        project.updates = [];
      }
      if (reason) {
        project.updates.push({
          id: crypto.randomUUID(),
          senderRole: 'customer',
          senderName: user.name,
          senderEmail: user.email,
          message: `Quotation declined: ${reason}`,
          createdAt: nowIso,
        });
      }
      appendAuditEntry(
        project,
        user.email,
        'customer',
        'Quotation Declined',
        reason || 'Customer declined the current quotation.',
      );
      pushStoreNotification(store, {
        recipientRole: 'admin',
        recipientUserId: null,
        projectId: project.id,
        projectReferenceId: project.referenceId,
        type: 'quotation_declined',
        title: `Quotation Declined · ${project.referenceId}`,
        message: `${project.fullName} declined the quotation for "${project.projectTitle}".${reason ? ` Note: ${reason}` : ''}`,
        linkPath: `/admin?project=${project.id}`,
      });
      return {status: 'ok' as const, project};
    });

    if (updated.status === 'not_found' || !updated.project) {
      res.status(404).json({error: 'Project or quotation not found.'});
      return;
    }
    if (updated.status === 'already_paid') {
      res.status(400).json({error: 'Paid projects cannot decline the quotation.'});
      return;
    }

    await sendEmailIfConfigured({
      to: OFFICIAL_EMAIL,
      replyTo: updated.project.email,
      subject: `[VERTYLEX Quotation Declined ${updated.project.referenceId}] ${updated.project.projectTitle}`,
      text: `${updated.project.fullName} declined the quotation for ${updated.project.referenceId}.\nReason: ${reason || 'No reason provided'}\n\nOpen in Admin Dashboard: ${getRequestOrigin(req)}/admin?project=${updated.project.id}`,
    });

    res.json({project: sanitizeProjectForCustomer(updated.project)});
  });

  app.post('/api/projects/:id/updates', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({error: 'Authentication required.'});
      return;
    }
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (message.length < 2 || message.length > 4000) {
      res.status(400).json({error: 'Please enter a message between 2 and 4000 characters.'});
      return;
    }

    const updated = await mutateStore((store) => {
      const project = store.projects.find(
        (p) => p.id === req.params.id && p.userId === user.id,
      );
      if (!project) return null;
      const nowIso = new Date().toISOString();
      if (!Array.isArray(project.updates)) {
        project.updates = [];
      }
      project.updates.push({
        id: crypto.randomUUID(),
        senderRole: 'customer',
        senderName: user.name,
        senderEmail: user.email,
        message,
        createdAt: nowIso,
      });
      if (project.status === 'More Information Required') {
        project.status = 'Under Review';
        project.progressStage = 'Under Review';
      }
      project.updatedAt = nowIso;
      appendAuditEntry(project, user.email, 'customer', 'Customer Reply', message.slice(0, 240));
      pushStoreNotification(store, {
        recipientRole: 'admin',
        recipientUserId: null,
        projectId: project.id,
        projectReferenceId: project.referenceId,
        type: 'customer_reply',
        title: `Project Update · ${project.referenceId}`,
        message: `${user.name} sent a message on "${project.projectTitle}".`,
        linkPath: `/admin?project=${project.id}`,
      });
      return project;
    });

    if (!updated) {
      res.status(404).json({error: 'Project not found.'});
      return;
    }

    await sendEmailIfConfigured({
      to: OFFICIAL_EMAIL,
      replyTo: updated.email,
      subject: `[VERTYLEX Customer Reply ${updated.referenceId}] ${updated.projectTitle}`,
      text: `Customer: ${updated.fullName} <${updated.email}>\nReference: ${updated.referenceId}\n\nMessage:\n${message}\n\nOpen in Admin Dashboard: ${getRequestOrigin(req)}/admin?project=${updated.id}`,
    });

    res.json({project: sanitizeProjectForCustomer(updated)});
  });

  app.post('/api/projects/:id/cancel', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({error: 'Authentication required.'});
      return;
    }
    const reason =
      typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 600) : '';

    const updated = await mutateStore((store) => {
      const project = store.projects.find(
        (p) => p.id === req.params.id && p.userId === user.id,
      );
      if (!project) return {status: 'not_found' as const, project: null};
      if (
        project.status === 'Payment Confirmed' ||
        project.status === 'Paid' ||
        project.status === 'In Progress' ||
        project.status === 'Completed'
      ) {
        return {status: 'locked' as const, project};
      }
      const nowIso = new Date().toISOString();
      project.status = 'Cancelled';
      project.progressStage = 'Cancelled';
      project.updatedAt = nowIso;
      appendAuditEntry(
        project,
        user.email,
        'customer',
        'Project Cancelled',
        reason || 'Cancelled by customer prior to payment.',
      );
      pushStoreNotification(store, {
        recipientRole: 'admin',
        recipientUserId: null,
        projectId: project.id,
        projectReferenceId: project.referenceId,
        type: 'project_cancelled',
        title: `Project Cancelled · ${project.referenceId}`,
        message: `${project.fullName} cancelled "${project.projectTitle}".`,
        linkPath: `/admin?project=${project.id}`,
      });
      return {status: 'ok' as const, project};
    });

    if (updated.status === 'not_found' || !updated.project) {
      res.status(404).json({error: 'Project not found.'});
      return;
    }
    if (updated.status === 'locked') {
      res.status(400).json({
        error: 'Paid or active projects cannot be self-cancelled. Please contact VERTYLEX support.',
      });
      return;
    }

    await sendEmailIfConfigured({
      to: OFFICIAL_EMAIL,
      replyTo: updated.project.email,
      subject: `[VERTYLEX Project Cancelled ${updated.project.referenceId}] ${updated.project.projectTitle}`,
      text: `${updated.project.fullName} cancelled unpaid project ${updated.project.referenceId}.\nReason: ${reason || 'Not specified'}\n\nOpen in Admin Dashboard: ${getRequestOrigin(req)}/admin?project=${updated.project.id}`,
    });

    res.json({project: sanitizeProjectForCustomer(updated.project)});
  });

  // Customer Notification Routes (Protected)
  app.get('/api/notifications', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({error: 'Authentication required.'});
      return;
    }
    const store = await readStore();
    const notifications = store.notifications
      .filter((n) => n.recipientRole === 'customer' && n.recipientUserId === user.id)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 50);
    const unreadCount = notifications.filter((n) => !n.read).length;
    res.json({notifications, unreadCount});
  });

  app.post('/api/notifications/:id/read', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({error: 'Authentication required.'});
      return;
    }
    await mutateStore((store) => {
      const target = store.notifications.find(
        (n) =>
          n.id === req.params.id && n.recipientRole === 'customer' && n.recipientUserId === user.id,
      );
      if (target) target.read = true;
    });
    res.json({ok: true});
  });

  app.post('/api/notifications/read-all', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({error: 'Authentication required.'});
      return;
    }
    await mutateStore((store) => {
      for (const n of store.notifications) {
        if (n.recipientRole === 'customer' && n.recipientUserId === user.id) {
          n.read = true;
        }
      }
    });
    res.json({ok: true});
  });

  // Authorized VERTYLEX Private Admin Dashboard Routes
  app.get('/api/admin/overview', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user || !isAdminUser(user)) {
      res.status(403).json({error: 'Authorized VERTYLEX administrator access required.'});
      return;
    }
    const store = await readStore();
    const ratesRes = await fetchLiveExchangeRates();
    const rates = ratesRes.rates;

    let newRequests = 0;
    let underReview = 0;
    let moreInfoRequired = 0;
    let quotationsSent = 0;
    let awaitingPayments = 0;
    let paidProjects = 0;
    let inProgressProjects = 0;
    let completedProjects = 0;
    let cancelledProjects = 0;

    for (const p of store.projects) {
      switch (p.status) {
        case 'New Request':
        case 'Received for Review':
          newRequests += 1;
          break;
        case 'Under Review':
          underReview += 1;
          break;
        case 'More Information Required':
          moreInfoRequired += 1;
          break;
        case 'Quotation Sent':
        case 'Awaiting Customer Approval':
        case 'Quotation Ready':
          quotationsSent += 1;
          break;
        case 'Awaiting Payment':
        case 'Quotation Accepted':
          awaitingPayments += 1;
          break;
        case 'Payment Confirmed':
        case 'Paid':
          paidProjects += 1;
          break;
        case 'In Progress':
          inProgressProjects += 1;
          break;
        case 'Completed':
          completedProjects += 1;
          break;
        case 'Cancelled':
          cancelledProjects += 1;
          break;
        default:
          underReview += 1;
          break;
      }
    }

    let totalRevenueUsd = 0;
    for (const pay of store.payments) {
      if (pay.status !== 'paid') continue;
      if (typeof pay.amountUsd === 'number' && Number.isFinite(pay.amountUsd)) {
        totalRevenueUsd += pay.amountUsd;
      } else if (pay.currency.toUpperCase() === 'USD') {
        totalRevenueUsd += pay.amount;
      } else if (rates && typeof rates[pay.currency.toUpperCase()] === 'number') {
        totalRevenueUsd += pay.amount / rates[pay.currency.toUpperCase()];
      }
    }

    const unreadNotificationsCount = store.notifications.filter(
      (n) => n.recipientRole === 'admin' && !n.read,
    ).length;

    res.json({
      kpis: {
        totalProjects: store.projects.length,
        newRequests,
        underReview,
        moreInfoRequired,
        quotationsSent,
        awaitingPayments,
        paidProjects,
        inProgressProjects,
        completedProjects,
        cancelledProjects,
        totalRevenueUsd: Math.round(totalRevenueUsd * 100) / 100,
        unreadNotificationsCount,
      },
    });
  });

  app.get('/api/admin/projects', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user || !isAdminUser(user)) {
      res.status(403).json({error: 'Authorized VERTYLEX administrator access required.'});
      return;
    }
    const statusFilter = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

    const store = await readStore();
    let list = [...store.projects];
    if (statusFilter && statusFilter !== 'ALL') {
      list = list.filter((p) => p.status === statusFilter);
    }
    if (q) {
      list = list.filter(
        (p) =>
          p.referenceId.toLowerCase().includes(q) ||
          p.projectTitle.toLowerCase().includes(q) ||
          p.fullName.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          p.selectedService.toLowerCase().includes(q) ||
          (p.countryName || '').toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    res.json({projects: list});
  });

  app.get('/api/admin/projects/:id', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user || !isAdminUser(user)) {
      res.status(403).json({error: 'Authorized VERTYLEX administrator access required.'});
      return;
    }
    const store = await readStore();
    const project = store.projects.find((p) => p.id === req.params.id);
    if (!project) {
      res.status(404).json({error: 'Project not found.'});
      return;
    }
    const payments = store.payments
      .filter((pay) => pay.projectId === project.id)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    res.json({project, payments});
  });

  app.get('/api/admin/payments', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user || !isAdminUser(user)) {
      res.status(403).json({error: 'Authorized VERTYLEX administrator access required.'});
      return;
    }
    const store = await readStore();
    const payments = [...store.payments].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    res.json({payments});
  });

  app.get('/api/admin/notifications', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user || !isAdminUser(user)) {
      res.status(403).json({error: 'Authorized VERTYLEX administrator access required.'});
      return;
    }
    const store = await readStore();
    const notifications = store.notifications
      .filter((n) => n.recipientRole === 'admin')
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 60);
    const unreadCount = notifications.filter((n) => !n.read).length;
    res.json({notifications, unreadCount});
  });

  app.post('/api/admin/notifications/:id/read', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user || !isAdminUser(user)) {
      res.status(403).json({error: 'Authorized VERTYLEX administrator access required.'});
      return;
    }
    await mutateStore((store) => {
      const target = store.notifications.find(
        (n) => n.id === req.params.id && n.recipientRole === 'admin',
      );
      if (target) target.read = true;
    });
    res.json({ok: true});
  });

  app.post('/api/admin/notifications/read-all', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user || !isAdminUser(user)) {
      res.status(403).json({error: 'Authorized VERTYLEX administrator access required.'});
      return;
    }
    await mutateStore((store) => {
      for (const n of store.notifications) {
        if (n.recipientRole === 'admin') {
          n.read = true;
        }
      }
    });
    res.json({ok: true});
  });

  app.patch('/api/admin/projects/:id/status', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user || !isAdminUser(user)) {
      res.status(403).json({error: 'Authorized VERTYLEX administrator access required.'});
      return;
    }
    const nextStatus = typeof req.body?.status === 'string' ? req.body.status.trim() : '';
    const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 800) : '';
    if (!PROJECT_STATUS_SET.has(nextStatus)) {
      res.status(400).json({error: 'Unsupported project status.'});
      return;
    }

    const updated = await mutateStore((store) => {
      const project = store.projects.find((p) => p.id === req.params.id);
      if (!project) return null;
      const previousStatus = project.status;
      const nowIso = new Date().toISOString();
      project.status = nextStatus;
      project.progressStage = nextStatus;
      project.updatedAt = nowIso;
      appendAuditEntry(
        project,
        user.email,
        'admin',
        'Status Updated',
        `${previousStatus} -> ${nextStatus}${note ? ` (${note})` : ''}`,
      );
      if (project.userId) {
        pushStoreNotification(store, {
          recipientRole: 'customer',
          recipientUserId: project.userId,
          projectId: project.id,
          projectReferenceId: project.referenceId,
          type: 'project_status',
          title: `Status Updated: ${nextStatus} · ${project.referenceId}`,
          message: `Your project "${project.projectTitle}" is now marked as ${nextStatus}.${note ? ` ${note}` : ''}`,
          linkPath: `/account?project=${project.id}`,
        });
      }
      return project;
    });

    if (!updated) {
      res.status(404).json({error: 'Project not found.'});
      return;
    }

    await sendEmailIfConfigured({
      to: updated.email,
      subject: `[VERTYLEX Project Update ${updated.referenceId}] Status: ${nextStatus}`,
      text: `Hello ${updated.fullName},\n\nThe status of your project (${updated.referenceId}: ${updated.projectTitle}) has been updated to: ${nextStatus}.${note ? `\n\nNote from VERTYLEX:\n${note}` : ''}\n\nOpen your Customer Dashboard: ${getRequestOrigin(req)}/account?project=${updated.id}`,
    });

    res.json({project: updated});
  });

  app.post('/api/admin/projects/:id/decision', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user || !isAdminUser(user)) {
      res.status(403).json({error: 'Authorized VERTYLEX administrator access required.'});
      return;
    }
    const decision = req.body?.decision === 'accept' ? 'accept' : req.body?.decision === 'decline' ? 'decline' : null;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 1000) : '';
    if (!decision) {
      res.status(400).json({error: 'Decision must be accept or decline.'});
      return;
    }

    const nextStatus = decision === 'accept' ? 'Under Review' : 'Cancelled';
    const updated = await mutateStore((store) => {
      const project = store.projects.find((p) => p.id === req.params.id);
      if (!project) return null;
      const nowIso = new Date().toISOString();
      project.status = nextStatus;
      project.progressStage = nextStatus;
      project.updatedAt = nowIso;
      if (reason && !Array.isArray(project.updates)) {
        project.updates = [];
      }
      if (reason) {
        project.updates!.push({
          id: crypto.randomUUID(),
          senderRole: 'admin',
          senderName: user.name,
          senderEmail: user.email,
          message:
            decision === 'accept'
              ? `Project accepted for review: ${reason}`
              : `Project declined: ${reason}`,
          createdAt: nowIso,
        });
      }
      appendAuditEntry(
        project,
        user.email,
        'admin',
        decision === 'accept' ? 'Project Accepted' : 'Project Declined',
        reason || `Marked as ${nextStatus}`,
      );
      if (project.userId) {
        pushStoreNotification(store, {
          recipientRole: 'customer',
          recipientUserId: project.userId,
          projectId: project.id,
          projectReferenceId: project.referenceId,
          type: 'project_status',
          title:
            decision === 'accept'
              ? `Project Accepted for Review · ${project.referenceId}`
              : `Project Request Declined · ${project.referenceId}`,
          message:
            decision === 'accept'
              ? `VERTYLEX accepted "${project.projectTitle}" for technical review.${reason ? ` ${reason}` : ''}`
              : `Your request "${project.projectTitle}" was declined.${reason ? ` Reason: ${reason}` : ''}`,
          linkPath: `/account?project=${project.id}`,
        });
      }
      return project;
    });

    if (!updated) {
      res.status(404).json({error: 'Project not found.'});
      return;
    }

    await sendEmailIfConfigured({
      to: updated.email,
      subject:
        decision === 'accept'
          ? `[VERTYLEX Project Under Review ${updated.referenceId}] ${updated.projectTitle}`
          : `[VERTYLEX Project Update ${updated.referenceId}] ${updated.projectTitle}`,
      text: `Hello ${updated.fullName},\n\n${
        decision === 'accept'
          ? `VERTYLEX has accepted your project (${updated.referenceId}: ${updated.projectTitle}) into active review.`
          : `After reviewing your request (${updated.referenceId}: ${updated.projectTitle}), VERTYLEX is unable to proceed at this time.`
      }${reason ? `\n\nMessage from VERTYLEX:\n${reason}` : ''}\n\nCustomer Dashboard: ${getRequestOrigin(req)}/account?project=${updated.id}`,
    });

    res.json({project: updated});
  });

  app.post('/api/admin/projects/:id/notes', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user || !isAdminUser(user)) {
      res.status(403).json({error: 'Authorized VERTYLEX administrator access required.'});
      return;
    }
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (text.length < 2 || text.length > 4000) {
      res.status(400).json({error: 'Note text must be between 2 and 4000 characters.'});
      return;
    }
    const updated = await mutateStore((store) => {
      const project = store.projects.find((p) => p.id === req.params.id);
      if (!project) return null;
      const nowIso = new Date().toISOString();
      if (!Array.isArray(project.internalNotes)) {
        project.internalNotes = [];
      }
      project.internalNotes.push({
        id: crypto.randomUUID(),
        authorEmail: user.email,
        authorName: user.name,
        text,
        createdAt: nowIso,
      });
      project.updatedAt = nowIso;
      appendAuditEntry(project, user.email, 'admin', 'Internal Note Added', 'Private admin note saved.');
      return project;
    });
    if (!updated) {
      res.status(404).json({error: 'Project not found.'});
      return;
    }
    res.json({project: updated});
  });

  app.post('/api/admin/projects/:id/timeline', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user || !isAdminUser(user)) {
      res.status(403).json({error: 'Authorized VERTYLEX administrator access required.'});
      return;
    }
    const deliveryTimeStatus =
      req.body?.deliveryTimeStatus === 'Achievable as Requested'
        ? 'Achievable as Requested'
        : req.body?.deliveryTimeStatus === 'Adjusted by Administrator'
          ? 'Adjusted by Administrator'
          : null;
    if (!deliveryTimeStatus) {
      res.status(400).json({error: 'Invalid delivery timeframe decision.'});
      return;
    }
    const confirmedDeliveryTime =
      typeof req.body?.confirmedDeliveryTime === 'string'
        ? req.body.confirmedDeliveryTime.trim().slice(0, 120)
        : '';
    if (deliveryTimeStatus === 'Adjusted by Administrator' && !confirmedDeliveryTime) {
      res.status(400).json({
        error: 'Please enter the confirmed timeframe when adjusting the requested schedule.',
      });
      return;
    }

    const updated = await mutateStore((store) => {
      const project = store.projects.find((p) => p.id === req.params.id);
      if (!project) return null;
      project.deliveryTimeStatus = deliveryTimeStatus;
      project.confirmedDeliveryTime =
        deliveryTimeStatus === 'Achievable as Requested'
          ? project.deliveryTime || confirmedDeliveryTime
          : confirmedDeliveryTime;
      project.updatedAt = new Date().toISOString();
      appendAuditEntry(
        project,
        user.email,
        'admin',
        'Delivery Time Reviewed',
        `${deliveryTimeStatus}${project.confirmedDeliveryTime ? `: ${project.confirmedDeliveryTime}` : ''}`,
      );
      pushStoreNotification(store, {
        recipientRole: 'customer',
        recipientUserId: project.userId,
        projectId: project.id,
        projectReferenceId: project.referenceId,
        type: 'status_updated',
        title: `Schedule Confirmed · ${project.referenceId}`,
        message:
          deliveryTimeStatus === 'Achievable as Requested'
            ? `Your requested delivery timeframe (${project.deliveryTime}) was confirmed achievable.`
            : `VERTYLEX proposed a confirmed delivery schedule: ${project.confirmedDeliveryTime}.`,
        linkPath: `/account?project=${project.id}`,
        emailSent: false,
      });
      return project;
    });

    if (!updated) {
      res.status(404).json({error: 'Project not found.'});
      return;
    }
    res.json({project: updated});
  });

  app.post('/api/admin/projects/:id/message', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user || !isAdminUser(user)) {
      res.status(403).json({error: 'Authorized VERTYLEX administrator access required.'});
      return;
    }
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const requestMoreInfo = req.body?.requestMoreInfo === true;
    if (message.length < 2 || message.length > 4000) {
      res.status(400).json({error: 'Please enter a message between 2 and 4000 characters.'});
      return;
    }

    const updated = await mutateStore((store) => {
      const project = store.projects.find((p) => p.id === req.params.id);
      if (!project) return null;
      const nowIso = new Date().toISOString();
      if (!Array.isArray(project.updates)) {
        project.updates = [];
      }
      project.updates.push({
        id: crypto.randomUUID(),
        senderRole: 'admin',
        senderName: user.name,
        senderEmail: user.email,
        message,
        requiresAction: requestMoreInfo,
        createdAt: nowIso,
      });
      if (requestMoreInfo) {
        project.status = 'More Information Required';
        project.progressStage = 'More Information Required';
      }
      project.updatedAt = nowIso;
      appendAuditEntry(
        project,
        user.email,
        'admin',
        requestMoreInfo ? 'Requested Additional Info' : 'Message Sent to Customer',
        message.slice(0, 240),
      );
      if (project.userId) {
        pushStoreNotification(store, {
          recipientRole: 'customer',
          recipientUserId: project.userId,
          projectId: project.id,
          projectReferenceId: project.referenceId,
          type: requestMoreInfo ? 'info_requested' : 'project_status',
          title: requestMoreInfo
            ? `Action Needed: More Info Requested · ${project.referenceId}`
            : `Message from VERTYLEX · ${project.referenceId}`,
          message,
          linkPath: `/account?project=${project.id}`,
        });
      }
      return project;
    });

    if (!updated) {
      res.status(404).json({error: 'Project not found.'});
      return;
    }

    await sendEmailIfConfigured({
      to: updated.email,
      subject: requestMoreInfo
        ? `[VERTYLEX Info Needed ${updated.referenceId}] ${updated.projectTitle}`
        : `[VERTYLEX Message ${updated.referenceId}] ${updated.projectTitle}`,
      text: `Hello ${updated.fullName},\n\nVERTYLEX sent an update regarding your project (${updated.referenceId}: ${updated.projectTitle}):\n\n${message}\n\nReply directly in your Customer Dashboard: ${getRequestOrigin(req)}/account?project=${updated.id}`,
    });

    res.json({project: updated});
  });

  app.post('/api/admin/projects/:id/progress', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user || !isAdminUser(user)) {
      res.status(403).json({error: 'Authorized VERTYLEX administrator access required.'});
      return;
    }
    const progressStage =
      typeof req.body?.progressStage === 'string' ? req.body.progressStage.trim() : '';
    const allowedLegacyAndNew = new Set<string>([
      ...PROJECT_STATUSES,
      'Brief Submitted',
      'Quotation Ready',
      'Approved for Payment',
      'Paid & In Production',
    ]);
    if (!allowedLegacyAndNew.has(progressStage)) {
      res.status(400).json({error: 'Invalid project progress stage.'});
      return;
    }
    const updated = await mutateStore((store) => {
      const project = store.projects.find((p) => p.id === req.params.id);
      if (!project) return null;
      project.progressStage = progressStage;
      if (PROJECT_STATUS_SET.has(progressStage)) {
        project.status = progressStage;
      } else if (progressStage === 'Completed') {
        project.status = 'Completed';
      }
      project.updatedAt = new Date().toISOString();
      appendAuditEntry(project, user.email, 'admin', 'Progress Stage Updated', progressStage);
      return project;
    });
    if (!updated) {
      res.status(404).json({error: 'Project not found.'});
      return;
    }
    res.json({project: updated});
  });

  app.post('/api/admin/projects/:id/quote', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user || !isAdminUser(user)) {
      res.status(403).json({error: 'Authorized VERTYLEX administrator access required.'});
      return;
    }

    const rawAmountUsd = Number(req.body?.amountUsd ?? req.body?.amount);
    const paymentOption = req.body?.paymentOption === 'deposit' ? 'deposit' : 'full';
    const rawDepositPercent = Number(req.body?.depositPercent);
    const depositPercent =
      paymentOption === 'deposit'
        ? Math.min(90, Math.max(10, Math.round(Number.isFinite(rawDepositPercent) ? rawDepositPercent : 50)))
        : 100;
    const settlementCurrencyRaw =
      typeof req.body?.settlementCurrency === 'string'
        ? req.body.settlementCurrency.trim().toUpperCase()
        : typeof req.body?.currency === 'string'
          ? req.body.currency.trim().toUpperCase()
          : 'USD';
    const settlementCurrency = ALLOWED_CURRENCY_CODES.has(settlementCurrencyRaw)
      ? settlementCurrencyRaw
      : 'USD';
    const summary = typeof req.body?.summary === 'string' ? req.body.summary.trim() : '';
    const deliverablesRaw = Array.isArray(req.body?.deliverables) ? req.body.deliverables : [];
    const deliverables = deliverablesRaw
      .filter((d: unknown): d is string => typeof d === 'string' && d.trim().length > 0)
      .map((d: string) => d.trim());
    const validUntil =
      typeof req.body?.validUntil === 'string' && req.body.validUntil.trim()
        ? req.body.validUntil.trim()
        : new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString().slice(0, 10);

    if (!Number.isFinite(rawAmountUsd) || rawAmountUsd <= 0) {
      res.status(400).json({error: 'Please enter a valid positive quotation amount in USD.'});
      return;
    }
    if (summary.length < 10) {
      res.status(400).json({error: 'Please enter a clear quotation scope summary (at least 10 characters).'});
      return;
    }

    const amountUsd = Math.round(rawAmountUsd * 100) / 100;
    const dueNowUsd = Math.round(amountUsd * (depositPercent / 100) * 100) / 100;
    const ratesRes = await fetchLiveExchangeRates();

    let resolvedSettlementCurrency = 'USD';
    let settlementDueAmount = dueNowUsd;
    let exchangeRateUsed = 1;

    if (
      settlementCurrency !== 'USD' &&
      ratesRes.ratesAvailable &&
      ratesRes.rates &&
      typeof ratesRes.rates[settlementCurrency] === 'number'
    ) {
      resolvedSettlementCurrency = settlementCurrency;
      exchangeRateUsed = ratesRes.rates[settlementCurrency];
      settlementDueAmount = roundMoneyForCurrency(dueNowUsd * exchangeRateUsed, settlementCurrency);
    }

    const updated = await mutateStore((store) => {
      const project = store.projects.find((p) => p.id === req.params.id);
      if (!project) return {status: 'not_found' as const, project: null};
      if (
        project.status === 'Payment Confirmed' ||
        project.status === 'Paid' ||
        project.status === 'In Progress' ||
        project.status === 'Completed'
      ) {
        return {status: 'already_paid' as const, project};
      }

      const customerCurr = (project.preferredCurrency || 'USD').toUpperCase();
      let customerEstimatedTotal: number | undefined;
      let customerEstimatedDueNow: number | undefined;
      let customerRate: number | undefined;
      if (customerCurr === 'USD') {
        customerEstimatedTotal = amountUsd;
        customerEstimatedDueNow = dueNowUsd;
        customerRate = 1;
      } else if (
        ratesRes.ratesAvailable &&
        ratesRes.rates &&
        typeof ratesRes.rates[customerCurr] === 'number'
      ) {
        customerRate = ratesRes.rates[customerCurr];
        customerEstimatedTotal = roundMoneyForCurrency(amountUsd * customerRate, customerCurr);
        customerEstimatedDueNow = roundMoneyForCurrency(dueNowUsd * customerRate, customerCurr);
      }

      const nowIso = new Date().toISOString();
      project.quotation = {
        amountUsd,
        paymentOption,
        depositPercent,
        dueNowUsd,
        amount: settlementDueAmount,
        currency: resolvedSettlementCurrency,
        customerDisplayCurrency: customerCurr,
        ...(customerEstimatedTotal !== undefined ? {customerEstimatedTotal} : {}),
        ...(customerEstimatedDueNow !== undefined ? {customerEstimatedDueNow} : {}),
        ...(customerRate !== undefined ? {exchangeRateAtQuote: customerRate} : {}),
        ...(ratesRes.source ? {rateSourceAtQuote: ratesRes.source} : {}),
        summary,
        deliverables,
        validUntil,
        quotedAt: nowIso,
        quotedBy: user.email,
      };
      if (
        project.status !== 'Payment Confirmed' &&
        project.status !== 'Paid' &&
        project.status !== 'In Progress' &&
        project.status !== 'Completed'
      ) {
        project.status = 'Quotation Sent';
        project.progressStage = 'Quotation Sent';
      }
      project.updatedAt = nowIso;
      appendAuditEntry(
        project,
        user.email,
        'admin',
        'Quotation Sent',
        `$${amountUsd.toLocaleString()} USD (${paymentOption === 'deposit' ? `${depositPercent}% deposit = $${dueNowUsd} USD due` : '100% full payment'})`,
      );
      if (project.userId) {
        pushStoreNotification(store, {
          recipientRole: 'customer',
          recipientUserId: project.userId,
          projectId: project.id,
          projectReferenceId: project.referenceId,
          type: 'quotation_sent',
          title: `Quotation Ready · ${project.referenceId}`,
          message: `VERTYLEX published a quotation of $${amountUsd.toLocaleString()} USD${
            paymentOption === 'deposit' ? ` (${depositPercent}% deposit: $${dueNowUsd.toLocaleString()} USD)` : ''
          } for "${project.projectTitle}".`,
          linkPath: `/account?project=${project.id}`,
        });
      }
      return {status: 'ok' as const, project};
    });

    if (updated.status === 'already_paid') {
      res.status(400).json({
        error: 'This project already has a confirmed payment and its active quotation cannot be overwritten.',
      });
      return;
    }

    const updatedProject = updated.status === 'ok' ? updated.project : null;
    const q = updatedProject?.quotation ?? null;
    if (!updatedProject || !q) {
      res.status(404).json({error: 'Project not found.'});
      return;
    }
    const localEstimateLine =
      q.customerDisplayCurrency &&
      q.customerDisplayCurrency !== 'USD' &&
      q.customerEstimatedDueNow !== undefined
        ? `\nEstimated Due in ${q.customerDisplayCurrency}: ${q.customerEstimatedDueNow.toLocaleString()} ${q.customerDisplayCurrency} (Live rate: 1 USD = ${q.exchangeRateAtQuote?.toFixed(2)} ${q.customerDisplayCurrency})`
        : '';

    await sendEmailIfConfigured({
      to: updatedProject.email,
      subject: `[VERTYLEX Quotation Ready ${updatedProject.referenceId}] ${updatedProject.projectTitle}`,
      text: [
        `Hello ${updatedProject.fullName},`,
        '',
        `VERTYLEX has reviewed your project (${updatedProject.referenceId}: ${updatedProject.projectTitle}) and prepared your official quotation.`,
        '',
        `Total Project Quote: $${q.amountUsd.toLocaleString()} USD`,
        `Payment Option: ${q.paymentOption === 'deposit' ? `Deposit (${q.depositPercent}% due now: $${q.dueNowUsd.toLocaleString()} USD)` : 'Full Payment (100%)'}`,
        localEstimateLine,
        `Valid Until: ${q.validUntil}`,
        '',
        'Scope Summary:',
        q.summary,
        q.deliverables.length > 0 ? `\nDeliverables:\n${q.deliverables.map((d) => `- ${d}`).join('\n')}` : '',
        '',
        `Review, accept, and proceed to secure payment in your Customer Dashboard:\n${getRequestOrigin(req)}/account?project=${updatedProject.id}`,
      ]
        .filter(Boolean)
        .join('\n'),
    });

    res.json({project: updatedProject});
  });

  // Payment Gateway Integration & Verified Webhooks (Paystack & Flutterwave)
  async function markPaymentConfirmed(params: {
    reference: string;
    gatewayTransactionId: string;
    channel: string;
    verifiedAmount?: number;
    verifiedCurrency?: string;
    viaWebhook: boolean;
    origin: string;
  }): Promise<{
    found: boolean;
    alreadyPaid: boolean;
    payment: StoredPayment | null;
    project: StoredProject | null;
  }> {
    const mutation = await mutateStore((draft) => {
      const pay = draft.payments.find((p) => p.reference === params.reference);
      if (!pay) {
        return {found: false, alreadyPaid: false, payment: null, project: null};
      }
      const proj = draft.projects.find((p) => p.id === pay.projectId) || null;
      if (pay.status === 'paid') {
        return {found: true, alreadyPaid: true, payment: pay, project: proj};
      }
      if (
        params.verifiedCurrency &&
        params.verifiedCurrency.toUpperCase() !== pay.currency.toUpperCase()
      ) {
        return {found: true, alreadyPaid: false, payment: pay, project: proj};
      }
      if (
        typeof params.verifiedAmount === 'number' &&
        params.verifiedAmount + 0.01 < pay.amount
      ) {
        return {found: true, alreadyPaid: false, payment: pay, project: proj};
      }

      const nowIso = new Date().toISOString();
      pay.status = 'paid';
      pay.gatewayTransactionId = params.gatewayTransactionId;
      pay.channel = params.channel;
      pay.webhookVerified = params.viaWebhook;
      pay.verifiedAt = nowIso;

      if (proj) {
        if (proj.status !== 'In Progress' && proj.status !== 'Completed') {
          proj.status = 'Payment Confirmed';
          proj.progressStage = 'Payment Confirmed';
        }
        proj.updatedAt = nowIso;
        appendAuditEntry(
          proj,
          pay.customerEmail || 'payment-gateway',
          'system',
          'Payment Confirmed',
          `${pay.currency} ${pay.amount.toLocaleString()} ($${pay.amountUsd ?? pay.amount} USD) verified via ${pay.provider}${params.viaWebhook ? ' webhook' : ''}. Ref: ${pay.reference}`,
        );
        pushStoreNotification(draft, {
          recipientRole: 'admin',
          recipientUserId: null,
          projectId: proj.id,
          projectReferenceId: proj.referenceId,
          type: 'payment_confirmed',
          title: `Payment Confirmed · ${proj.referenceId}`,
          message: `${pay.customerName || proj.fullName} paid ${pay.currency} ${pay.amount.toLocaleString()} via ${pay.provider} for "${proj.projectTitle}".`,
          linkPath: `/admin?project=${proj.id}`,
        });
        if (proj.userId) {
          pushStoreNotification(draft, {
            recipientRole: 'customer',
            recipientUserId: proj.userId,
            projectId: proj.id,
            projectReferenceId: proj.referenceId,
            type: 'payment_confirmed',
            title: `Payment Receipt Confirmed · ${pay.reference}`,
            message: `We confirmed your payment of ${pay.currency} ${pay.amount.toLocaleString()} for "${proj.projectTitle}". Work can now proceed.`,
            linkPath: `/checkout/${proj.id}?reference=${pay.reference}`,
          });
        }
      }

      return {found: true, alreadyPaid: false, payment: pay, project: proj};
    });

    if (mutation.found && !mutation.alreadyPaid && mutation.payment?.status === 'paid') {
      const pay = mutation.payment;
      const proj = mutation.project;
      await Promise.all([
        sendEmailIfConfigured({
          to: OFFICIAL_EMAIL,
          subject: `[VERTYLEX Payment Confirmed ${pay.projectReferenceId}] ${pay.currency} ${pay.amount.toLocaleString()}`,
          text: [
            `Verified payment received via ${pay.provider.toUpperCase()}.`,
            `Transaction Ref: ${pay.reference}`,
            `Project: ${pay.projectReferenceId} — ${pay.projectTitle}`,
            `Customer: ${proj?.fullName || pay.customerName || 'Customer'} <${proj?.email || pay.customerEmail || ''}>`,
            `Amount Settled: ${pay.currency} ${pay.amount.toLocaleString()} (USD Equivalent: $${(pay.amountUsd ?? 0).toLocaleString()})`,
            `Channel: ${pay.channel || 'gateway'}`,
            `Verified At: ${pay.verifiedAt}`,
            `Admin Dashboard: ${params.origin}/admin?project=${pay.projectId}`,
          ].join('\n'),
        }),
        proj?.email
          ? sendEmailIfConfigured({
              to: proj.email,
              subject: `[VERTYLEX Payment Receipt ${pay.reference}] ${pay.projectTitle}`,
              text: [
                `Hello ${proj.fullName},`,
                '',
                `Thank you! Your payment for ${pay.projectReferenceId} (${pay.projectTitle}) has been verified and confirmed.`,
                '',
                `Receipt Reference: ${pay.reference}`,
                `Provider: ${pay.provider.toUpperCase()} (${pay.channel || 'online'})`,
                `Amount Paid: ${pay.currency} ${pay.amount.toLocaleString()}`,
                `USD Value: $${(pay.amountUsd ?? 0).toLocaleString()} USD`,
                `Confirmed At: ${pay.verifiedAt}`,
                '',
                `View your receipt & project progress: ${params.origin}/account?project=${pay.projectId}`,
              ].join('\n'),
            })
          : Promise.resolve({sent: false, configured: false}),
      ]);
    }

    return mutation;
  }

  app.get('/api/payments/history', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({error: 'Authentication required.'});
      return;
    }
    const store = await readStore();
    const payments = store.payments
      .filter((p) => p.userId === user.id)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    res.json({payments});
  });

  app.post('/api/payments/initialize', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({error: 'Authentication required.'});
      return;
    }

    const projectId = typeof req.body?.projectId === 'string' ? req.body.projectId.trim() : '';
    const requestedProvider: 'paystack' | 'flutterwave' | null =
      req.body?.provider === 'paystack'
        ? 'paystack'
        : req.body?.provider === 'flutterwave'
          ? 'flutterwave'
          : null;
    const requestedCheckoutCurrency =
      typeof req.body?.checkoutCurrency === 'string'
        ? req.body.checkoutCurrency.trim().toUpperCase()
        : '';

    const paymentStatus = getPaymentStatus();
    const provider = requestedProvider || paymentStatus.activeProvider;

    if (!provider || !paymentStatus.providers[provider].configured) {
      res.status(503).json({
        gatewayConfigured: false,
        error:
          'Online payment checkout is inactive because live Paystack or Flutterwave API credentials have not been configured on this server.',
      });
      return;
    }

    const store = await readStore();
    const project = store.projects.find((p) => p.id === projectId && p.userId === user.id);
    if (!project) {
      res.status(404).json({error: 'Project not found.'});
      return;
    }
    if (!project.quotation) {
      res.status(400).json({error: 'This project does not have a quotation yet.'});
      return;
    }
    if (project.status === 'Cancelled') {
      res.status(400).json({error: 'This project has been cancelled.'});
      return;
    }
    const alreadyPaid =
      project.status === 'Payment Confirmed' ||
      project.status === 'Paid' ||
      project.status === 'In Progress' ||
      project.status === 'Completed' ||
      store.payments.some((pay) => pay.projectId === project.id && pay.status === 'paid');
    if (alreadyPaid) {
      res.status(400).json({error: 'This project quotation has already been paid and confirmed.'});
      return;
    }

    // Authoritative server-side calculation from USD base quotation + live exchange rates
    const dueNowUsd =
      typeof project.quotation.dueNowUsd === 'number' && project.quotation.dueNowUsd > 0
        ? project.quotation.dueNowUsd
        : project.quotation.currency === 'USD'
          ? project.quotation.amount
          : project.quotation.amountUsd || project.quotation.amount;

    const supportedByProvider = paymentStatus.providers[provider].supportedCurrencies;
    const preferredCurrency =
      requestedCheckoutCurrency && supportedByProvider.includes(requestedCheckoutCurrency)
        ? requestedCheckoutCurrency
        : supportedByProvider.includes(project.quotation.currency.toUpperCase())
          ? project.quotation.currency.toUpperCase()
          : 'USD';

    const ratesRes = await fetchLiveExchangeRates();
    let settlementCurrency = preferredCurrency;
    let settlementAmount = dueNowUsd;
    let exchangeRateUsed = 1;

    if (settlementCurrency !== 'USD') {
      if (
        ratesRes.ratesAvailable &&
        ratesRes.rates &&
        typeof ratesRes.rates[settlementCurrency] === 'number'
      ) {
        exchangeRateUsed = ratesRes.rates[settlementCurrency];
        settlementAmount = roundMoneyForCurrency(dueNowUsd * exchangeRateUsed, settlementCurrency);
      } else if (project.quotation.currency.toUpperCase() === settlementCurrency) {
        settlementAmount = project.quotation.amount;
      } else {
        settlementCurrency = 'USD';
        settlementAmount = dueNowUsd;
        exchangeRateUsed = 1;
      }
    } else if (typeof project.quotation.dueNowUsd !== 'number' && project.quotation.currency !== 'USD') {
      settlementCurrency = project.quotation.currency;
      settlementAmount = project.quotation.amount;
    }

    const txReference = createReferenceId('VTXPAY');
    const callbackUrl = `${getRequestOrigin(req)}/checkout/${project.id}?provider=${provider}`;

    try {
      let authorizationUrl = '';

      if (provider === 'paystack') {
        const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: user.email,
            amount: Math.round(settlementAmount * 100), // lowest subunit (kobo/cents)
            currency: settlementCurrency,
            reference: txReference,
            callback_url: callbackUrl,
            metadata: {
              projectId: project.id,
              projectReferenceId: project.referenceId,
              userId: user.id,
              dueNowUsd,
            },
          }),
        });
        const pData = (await paystackRes.json()) as {
          status?: boolean;
          message?: string;
          data?: {authorization_url?: string};
        };
        if (!paystackRes.ok || !pData.status || !pData.data?.authorization_url) {
          throw new Error(pData.message || 'Paystack initialization failed.');
        }
        authorizationUrl = pData.data.authorization_url;
      } else {
        const flwRes = await fetch('https://api.flutterwave.com/v3/payments', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tx_ref: txReference,
            amount: settlementAmount,
            currency: settlementCurrency,
            redirect_url: callbackUrl,
            customer: {
              email: user.email,
              name: user.name,
            },
            customizations: {
              title: 'VERTYLEX Project Payment',
              description: `${project.referenceId}: ${project.projectTitle}`,
            },
            meta: {
              projectId: project.id,
              projectReferenceId: project.referenceId,
              dueNowUsd,
            },
          }),
        });
        const fData = (await flwRes.json()) as {
          status?: string;
          message?: string;
          data?: {link?: string};
        };
        if (!flwRes.ok || fData.status !== 'success' || !fData.data?.link) {
          throw new Error(fData.message || 'Flutterwave initialization failed.');
        }
        authorizationUrl = fData.data.link;
      }

      const paymentRecord: StoredPayment = {
        id: crypto.randomUUID(),
        reference: txReference,
        projectId: project.id,
        projectReferenceId: project.referenceId,
        projectTitle: project.projectTitle,
        userId: user.id,
        customerEmail: user.email,
        customerName: user.name,
        provider,
        amountUsd: dueNowUsd,
        amount: settlementAmount,
        currency: settlementCurrency,
        displayAmount: project.quotation.customerEstimatedDueNow,
        displayCurrency: project.quotation.customerDisplayCurrency || project.preferredCurrency,
        exchangeRateUsed,
        feeEstimateNote:
          'Standard gateway processing fees are disclosed on the secure hosted checkout page.',
        paymentOption: project.quotation.paymentOption || 'full',
        depositPercent: project.quotation.depositPercent ?? 100,
        status: 'pending',
        authorizationUrl,
        createdAt: new Date().toISOString(),
      };

      await mutateStore((draft) => {
        const targetProj = draft.projects.find((p) => p.id === project.id);
        if (
          targetProj &&
          targetProj.quotation &&
          (targetProj.status === 'Quotation Sent' ||
            targetProj.status === 'Awaiting Customer Approval' ||
            targetProj.status === 'Quotation Ready')
        ) {
          targetProj.status = 'Awaiting Payment';
          targetProj.progressStage = 'Awaiting Payment';
          targetProj.updatedAt = new Date().toISOString();
          if (!targetProj.quotation.acceptedAt) {
            targetProj.quotation.acceptedAt = new Date().toISOString();
          }
        }
        draft.payments.push(paymentRecord);
      });

      res.json({
        reference: txReference,
        provider,
        amount: settlementAmount,
        currency: settlementCurrency,
        dueNowUsd,
        authorizationUrl,
      });
    } catch (err) {
      console.error('Payment initialization error:', err);
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Unable to initialize payment checkout.',
      });
    }
  });

  app.get('/api/payments/verify', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({error: 'Authentication required.'});
      return;
    }

    const reference =
      typeof req.query.reference === 'string'
        ? req.query.reference.trim()
        : typeof req.query.tx_ref === 'string'
          ? req.query.tx_ref.trim()
          : '';
    if (!reference) {
      res.status(400).json({error: 'Transaction reference is required.'});
      return;
    }

    const store = await readStore();
    const record = store.payments.find((p) => p.reference === reference && p.userId === user.id);
    if (!record) {
      res.status(404).json({error: 'Transaction record not found.'});
      return;
    }

    if (record.status === 'paid') {
      res.json({payment: record});
      return;
    }

    try {
      let verifiedSuccess = false;
      let gatewayId = '';
      let channel = '';
      let verifiedAmount = record.amount;
      let verifiedCurrency = record.currency;

      if (record.provider === 'paystack') {
        if (!process.env.PAYSTACK_SECRET_KEY) {
          throw new Error('Paystack secret key is not configured.');
        }
        const vRes = await fetch(
          `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
          {
            headers: {Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`},
          },
        );
        const vData = (await vRes.json()) as {
          status?: boolean;
          data?: {status?: string; id?: number; channel?: string; amount?: number; currency?: string};
        };
        if (
          vRes.ok &&
          vData.status &&
          vData.data?.status === 'success' &&
          typeof vData.data.amount === 'number' &&
          vData.data.amount >= Math.round(record.amount * 100) &&
          vData.data.currency === record.currency
        ) {
          verifiedSuccess = true;
          gatewayId = String(vData.data.id || '');
          channel = vData.data.channel || 'card';
          verifiedAmount = vData.data.amount / 100;
          verifiedCurrency = vData.data.currency;
        }
      } else {
        if (!process.env.FLW_SECRET_KEY) {
          throw new Error('Flutterwave secret key is not configured.');
        }
        const vRes = await fetch(
          `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
          {
            headers: {Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`},
          },
        );
        const vData = (await vRes.json()) as {
          status?: string;
          data?: {
            status?: string;
            id?: number;
            payment_type?: string;
            amount?: number;
            currency?: string;
          };
        };
        if (
          vRes.ok &&
          vData.status === 'success' &&
          vData.data?.status === 'successful' &&
          Number(vData.data.amount) >= record.amount &&
          vData.data.currency === record.currency
        ) {
          verifiedSuccess = true;
          gatewayId = String(vData.data.id || '');
          channel = vData.data.payment_type || 'card';
          verifiedAmount = Number(vData.data.amount);
          verifiedCurrency = vData.data.currency;
        }
      }

      if (verifiedSuccess) {
        const result = await markPaymentConfirmed({
          reference: record.reference,
          gatewayTransactionId: gatewayId,
          channel,
          verifiedAmount,
          verifiedCurrency,
          viaWebhook: false,
          origin: getRequestOrigin(req),
        });
        res.json({payment: result.payment});
      } else {
        const failedPayment = await mutateStore((draft) => {
          const pay = draft.payments.find((p) => p.id === record.id);
          if (!pay) return null;
          if (pay.status !== 'paid') {
            pay.status = 'failed';
          }
          return pay;
        });
        res.json({payment: failedPayment});
      }
    } catch (err) {
      console.error('Payment verification error:', err);
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Unable to verify payment status.',
      });
    }
  });

  app.post('/api/payments/webhook/paystack', async (req: Request, res: Response) => {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      res.status(503).json({error: 'Paystack webhook verification is not configured.'});
      return;
    }
    const signatureHeader = req.headers['x-paystack-signature'];
    const signature = typeof signatureHeader === 'string' ? signatureHeader.trim() : '';
    const rawBody = (req as Request & {rawBody?: Buffer}).rawBody;
    if (!signature || !rawBody) {
      res.status(401).json({error: 'Missing webhook signature.'});
      return;
    }
    const expected = crypto.createHmac('sha512', secretKey).update(rawBody).digest('hex');
    const sigBuf = Buffer.from(signature, 'utf8');
    const expBuf = Buffer.from(expected, 'utf8');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      res.status(401).json({error: 'Invalid Paystack webhook signature.'});
      return;
    }

    const event = req.body?.event;
    const data = req.body?.data as
      | {
          reference?: string;
          status?: string;
          id?: number | string;
          channel?: string;
          amount?: number;
          currency?: string;
        }
      | undefined;

    if (event === 'charge.success' && data?.status === 'success' && data.reference) {
      await markPaymentConfirmed({
        reference: data.reference,
        gatewayTransactionId: String(data.id || ''),
        channel: data.channel || 'paystack',
        verifiedAmount: typeof data.amount === 'number' ? data.amount / 100 : undefined,
        verifiedCurrency: data.currency,
        viaWebhook: true,
        origin: getRequestOrigin(req),
      });
    }

    res.status(200).json({received: true});
  });

  app.post('/api/payments/webhook/flutterwave', async (req: Request, res: Response) => {
    const flwSecret = process.env.FLW_SECRET_KEY;
    const webhookHash = process.env.FLW_WEBHOOK_HASH;
    if (!flwSecret && !webhookHash) {
      res.status(503).json({error: 'Flutterwave webhook verification is not configured.'});
      return;
    }

    const incomingHash =
      typeof req.headers['verif-hash'] === 'string' ? req.headers['verif-hash'].trim() : '';
    if (webhookHash) {
      const a = Buffer.from(incomingHash, 'utf8');
      const b = Buffer.from(webhookHash, 'utf8');
      if (!incomingHash || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        res.status(401).json({error: 'Invalid Flutterwave webhook signature.'});
        return;
      }
    } else if (!incomingHash) {
      res.status(401).json({error: 'Missing Flutterwave verification header.'});
      return;
    }

    const event = req.body?.event;
    const data = req.body?.data as
      | {
          id?: number | string;
          tx_ref?: string;
          status?: string;
          amount?: number;
          currency?: string;
          payment_type?: string;
        }
      | undefined;

    if (event === 'charge.completed' && data?.status === 'successful' && data.tx_ref) {
      if (flwSecret && data.id) {
        const verifyRes = await fetch(
          `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(String(data.id))}/verify`,
          {headers: {Authorization: `Bearer ${flwSecret}`}},
        );
        const vJson = (await verifyRes.json()) as {
          status?: string;
          data?: {status?: string; amount?: number; currency?: string; payment_type?: string};
        };
        if (
          verifyRes.ok &&
          vJson.status === 'success' &&
          vJson.data?.status === 'successful'
        ) {
          await markPaymentConfirmed({
            reference: data.tx_ref,
            gatewayTransactionId: String(data.id),
            channel: vJson.data.payment_type || data.payment_type || 'flutterwave',
            verifiedAmount: Number(vJson.data.amount),
            verifiedCurrency: vJson.data.currency,
            viaWebhook: true,
            origin: getRequestOrigin(req),
          });
        }
      } else {
        await markPaymentConfirmed({
          reference: data.tx_ref,
          gatewayTransactionId: String(data.id || ''),
          channel: data.payment_type || 'flutterwave',
          verifiedAmount: typeof data.amount === 'number' ? data.amount : undefined,
          verifiedCurrency: data.currency,
          viaWebhook: true,
          origin: getRequestOrigin(req),
        });
      }
    }

    res.status(200).json({received: true});
  });

  // Contact Enquiry Route (Protected)
  app.post('/api/contact', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({
        error: 'Please sign in or create an account to send an enquiry through the VERTYLEX system.',
      });
      return;
    }

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const emailRaw = typeof req.body?.email === 'string' ? req.body.email : '';
    const email = normalizeEmail(emailRaw);
    const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : '';
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';

    if (name.length < 2 || name.length > 120) {
      res.status(400).json({error: 'Please enter your name.'});
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({error: 'Please enter a valid email address.'});
      return;
    }
    if (subject.length < 2 || subject.length > 160) {
      res.status(400).json({error: 'Please enter a subject.'});
      return;
    }
    if (message.length < 10 || message.length > 4000) {
      res.status(400).json({error: 'Please enter a message of at least 10 characters.'});
      return;
    }

    const contact: StoredContact = {
      id: crypto.randomUUID(),
      referenceId: createReferenceId('ENQ'),
      name,
      email,
      subject,
      message,
      createdAt: new Date().toISOString(),
    };

    await mutateStore((store) => {
      store.contacts.push(contact);
    });

    const emailResult = await sendEmailIfConfigured({
      to: OFFICIAL_EMAIL,
      replyTo: email,
      subject: `[VERTYLEX Contact ${contact.referenceId}] ${subject}`,
      text: `Reference ID: ${contact.referenceId}\nAccount ID: ${user.id}\nFrom: ${name} <${email}>\n\n${message}`,
    });

    res.status(201).json({
      contact,
      emailDelivered: emailResult.sent,
      smtpConfigured: emailResult.configured,
    });
  });

  // Unknown /api routes should return 404 JSON
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({error: 'API route not found.'});
  });

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Server error:', err);
    res.status(500).json({error: 'Internal server error.'});
  });

  // Vite / Static Frontend Serving
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.get('*', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const htmlPath = path.resolve(__dirname, 'index.html');
        const template = await fsp.readFile(htmlPath, 'utf8');
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({'Content-Type': 'text/html'}).end(html);
      } catch (e) {
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VERTYLEX server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start VERTYLEX server:', err);
  process.exit(1);
});
