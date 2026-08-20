import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as events from '../controllers/event.controller.js';

export const eventRouter = Router();
eventRouter.use(authenticate);
eventRouter.get('/', events.listEvents);
eventRouter.get('/:id', events.getEvent);
eventRouter.get('/:id/participants', events.participants);
eventRouter.post('/', events.createEvent);
eventRouter.patch('/:id', events.updateEvent);
eventRouter.delete('/:id', events.deleteEvent);
eventRouter.post('/:id/register', events.register);
eventRouter.delete('/:id/register', events.unregister);
