import type { RequestHandler } from 'express';
import { EventParticipantStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/app-error.js';
import { asyncHandler } from '../utils/async-handler.js';

const page = (value: unknown, fallback: number) => Math.max(1, Math.min(Number(value) || fallback, 50));
const idOf = (value: unknown) => typeof value === 'string' ? value : Array.isArray(value) ? value[0] : undefined;
const fields = (userId: string) => ({ id: true, title: true, description: true, banner: true, category: true, organizerId: true, venue: true, location: true, startDate: true, endDate: true, registrationDeadline: true, maxParticipants: true, createdAt: true, participants: { where: { userId }, select: { status: true } }, _count: { select: { participants: { where: { status: EventParticipantStatus.REGISTERED } } } } });
const present = (event: any) => ({ ...event, registrationStatus: event.participants[0]?.status ?? null, registered: Boolean(event.participants[0]), participants: undefined });

export const listEvents: RequestHandler = asyncHandler(async (req, res) => {
  const current = page(req.query.page, 1), limit = page(req.query.limit, 20);
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const category = typeof req.query.category === 'string' && req.query.category !== 'all' ? req.query.category : undefined;
  const location = typeof req.query.location === 'string' ? req.query.location.trim() : undefined;
  const upcoming = req.query.upcoming === 'true';
  const where = { ...(category ? { category: { equals: category, mode: 'insensitive' as const } } : {}), ...(location ? { location: { contains: location, mode: 'insensitive' as const } } : {}), ...(upcoming ? { endDate: { gte: new Date() } } : {}), ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' as const } }, { description: { contains: q, mode: 'insensitive' as const } }, { category: { contains: q, mode: 'insensitive' as const } }, { location: { contains: q, mode: 'insensitive' as const } }, { venue: { contains: q, mode: 'insensitive' as const } }] } : {}) };
  const [data, total] = await prisma.$transaction([prisma.event.findMany({ where, skip: (current - 1) * limit, take: limit, orderBy: { startDate: 'asc' }, select: fields(req.auth!.sub) }), prisma.event.count({ where })]);
  res.json({ success: true, data: data.map(present), pagination: { page: current, limit, total, totalPages: Math.ceil(total / limit) } });
});

export const getEvent: RequestHandler = asyncHandler(async (req, res) => {
  const id = idOf(req.params.id); if (!id) throw new AppError(400, 'VALIDATION_ERROR', 'Event ID is required.');
  const event = await prisma.event.findUnique({ where: { id }, select: fields(req.auth!.sub) }); if (!event) throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found.');
  const organizer = await prisma.user.findUnique({ where: { id: event.organizerId }, select: { id: true, fullName: true, avatar: true, college: true, course: true } });
  res.json({ success: true, data: { ...present(event), organizer } });
});

export const createEvent: RequestHandler = asyncHandler(async (req, res) => {
  const b = req.body as Record<string, unknown>; const required = ['title', 'description', 'category', 'venue', 'location', 'startDate', 'endDate'];
  if (required.some((key) => !b[key] || !String(b[key]).trim())) throw new AppError(400, 'VALIDATION_ERROR', 'Title, description, category, venue, location, start date and end date are required.');
  const startDate = new Date(String(b.startDate)), endDate = new Date(String(b.endDate)), deadline = b.registrationDeadline ? new Date(String(b.registrationDeadline)) : null;
  if (Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf()) || endDate <= startDate) throw new AppError(400, 'VALIDATION_ERROR', 'Provide a valid event date range.');
  if (deadline && (Number.isNaN(deadline.valueOf()) || deadline > startDate)) throw new AppError(400, 'VALIDATION_ERROR', 'Registration deadline must be before the event starts.');
  const data = await prisma.event.create({ data: { title: String(b.title).trim(), description: String(b.description).trim(), category: String(b.category).trim(), venue: String(b.venue).trim(), location: String(b.location).trim(), startDate, endDate, registrationDeadline: deadline || undefined, maxParticipants: b.maxParticipants ? Number(b.maxParticipants) : undefined, banner: b.banner ? String(b.banner).trim() : undefined, organizerId: req.auth!.sub } });
  res.status(201).json({ success: true, data });
});

export const updateEvent: RequestHandler = asyncHandler(async (req, res) => { const id = idOf(req.params.id); const found = await prisma.event.findUnique({ where: { id } }); if (!found) throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found.'); if (found.organizerId !== req.auth!.sub) throw new AppError(403, 'FORBIDDEN', 'Only the organizer can edit this event.'); const { organizerId, createdAt, updatedAt, id: ignored, ...body } = req.body as Record<string, unknown>; const data = await prisma.event.update({ where: { id }, data: body }); res.json({ success: true, data }); });
export const deleteEvent: RequestHandler = asyncHandler(async (req, res) => { const id = idOf(req.params.id); const found = await prisma.event.findUnique({ where: { id } }); if (!found) throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found.'); if (found.organizerId !== req.auth!.sub) throw new AppError(403, 'FORBIDDEN', 'Only the organizer can delete this event.'); await prisma.event.delete({ where: { id } }); res.status(204).send(); });

export const register: RequestHandler = asyncHandler(async (req, res) => {
  const id = idOf(req.params.id); const event = await prisma.event.findUnique({ where: { id }, include: { _count: { select: { participants: { where: { status: EventParticipantStatus.REGISTERED } } } } } });
  if (!event) throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found.'); if (event.endDate <= new Date()) throw new AppError(409, 'EVENT_ENDED', 'This event has already ended.'); if (event.registrationDeadline && event.registrationDeadline < new Date()) throw new AppError(409, 'REGISTRATION_CLOSED', 'Registration has closed.');
  const existing = await prisma.eventParticipant.findUnique({ where: { eventId_userId: { eventId: event.id, userId: req.auth!.sub } } }); if (existing) throw new AppError(409, 'ALREADY_REGISTERED', 'You are already registered for this event.');
  const status = event.maxParticipants && event._count.participants >= event.maxParticipants ? EventParticipantStatus.WAITLISTED : EventParticipantStatus.REGISTERED;
  const data = await prisma.eventParticipant.create({ data: { eventId: event.id, userId: req.auth!.sub, status } }); res.status(201).json({ success: true, data });
});

export const unregister: RequestHandler = asyncHandler(async (req, res) => { const id = idOf(req.params.id); const existing = await prisma.eventParticipant.findUnique({ where: { eventId_userId: { eventId: id!, userId: req.auth!.sub } } }); if (!existing) throw new AppError(404, 'REGISTRATION_NOT_FOUND', 'You are not registered for this event.'); await prisma.eventParticipant.delete({ where: { eventId_userId: { eventId: id!, userId: req.auth!.sub } } }); res.status(204).send(); });
export const participants: RequestHandler = asyncHandler(async (req, res) => { const id = idOf(req.params.id); const event = await prisma.event.findUnique({ where: { id }, select: { id: true } }); if (!event) throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found.'); const data = await prisma.eventParticipant.findMany({ where: { eventId: id }, select: { status: true, user: { select: { id: true, fullName: true, avatar: true, college: true, course: true, year: true } } } }); res.json({ success: true, data }); });
