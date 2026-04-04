import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * 标记为公开路由，不需要 JWT 认证
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
