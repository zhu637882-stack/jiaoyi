import { Injectable, CanActivate, ExecutionContext, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../../database/entities/user.entity';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

// 角色优先级映射：ADMIN > MANAGER > VIEWER > USER
const ROLE_HIERARCHY: Record<string, number> = {
  [UserRole.USER]: 0,
  [UserRole.VIEWER]: 1,
  [UserRole.MANAGER]: 2,
  [UserRole.ADMIN]: 3,
  // 兼容旧值
  'investor': 0,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (!requiredRoles) {
      return true;
    }
    
    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException('未登录');
    }

    // 检查用户角色是否在允许列表中，或者角色优先级更高
    const userLevel = ROLE_HIERARCHY[user.role] ?? 0;
    const minRequiredLevel = Math.min(
      ...requiredRoles.map(role => ROLE_HIERARCHY[role] ?? 0)
    );

    // 如果用户角色级别 >= 任一所需角色的最低级别，则通过
    // 但更精确：用户角色必须在允许列表中，或优先级高于列表中最低的
    const hasRole = requiredRoles.includes(user.role) || userLevel >= minRequiredLevel;
    
    if (!hasRole) {
      throw new ForbiddenException('权限不足');
    }
    
    return true;
  }
}
