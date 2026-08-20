import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as community from '../controllers/community.controller.js';

export const communityRouter = Router();
communityRouter.use(authenticate);
communityRouter.get('/', community.listCommunities);
communityRouter.get('/:id', community.getCommunity);
communityRouter.get('/:id/members', community.members);
communityRouter.post('/', community.createCommunity);
communityRouter.post('/:id/join', community.joinCommunity);
communityRouter.delete('/:id/leave', community.leaveCommunity);
