import { Controller, Get, Put, Delete, Post, Body, Param, UseGuards, HttpCode, HttpStatus, ForbiddenException } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { ReviewUserDto } from './dto/review-user.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UserRole } from '../../database/entities/user.entity';

@Controller('users')
export class UserController {
  constructor(private userService: UserService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAllUsers() {
    return this.userService.findAll();
  }

  // ============ 管理员管理接口 ============

  @Get('admins')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAdmins() {
    return this.userService.findAdmins();
  }

  @Post('admins')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async createAdmin(
    @Body() createAdminDto: CreateAdminDto,
    @CurrentUser('userId') operatorId: string,
  ) {
    return this.userService.createAdmin(createAdminDto, operatorId);
  }

  @Put('admins/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateAdmin(
    @Param('id') adminId: string,
    @Body() adminUpdateUserDto: AdminUpdateUserDto,
    @CurrentUser('userId') operatorId: string,
  ) {
    // 不能修改自己的角色
    if (adminId === operatorId && adminUpdateUserDto.role && adminUpdateUserDto.role !== UserRole.ADMIN) {
      throw new ForbiddenException('不能修改自己的角色');
    }
    return this.userService.updateAdmin(adminId, adminUpdateUserDto, operatorId);
  }

  @Delete('admins/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async deleteAdmin(
    @Param('id') adminId: string,
    @CurrentUser('userId') operatorId: string,
  ) {
    if (adminId === operatorId) {
      throw new ForbiddenException('不能删除自己');
    }
    return this.userService.deleteAdmin(adminId, operatorId);
  }

  // ============ 普通用户接口 ============

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser('userId') userId: string) {
    return this.userService.getUserWithBalance(userId);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(
    @CurrentUser('userId') userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.updateUser(userId, updateUserDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async adminUpdateUser(
    @Param('id') userId: string,
    @Body() adminUpdateUserDto: AdminUpdateUserDto,
  ) {
    return this.userService.updateUser(userId, adminUpdateUserDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async deleteUser(@Param('id') userId: string) {
    return this.userService.deleteUser(userId);
  }

  @Post(':id/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async reviewUser(
    @Param('id') userId: string,
    @Body() reviewUserDto: ReviewUserDto,
    @CurrentUser('userId') reviewerId: string,
  ) {
    return this.userService.reviewUser(userId, reviewUserDto, reviewerId);
  }
}
