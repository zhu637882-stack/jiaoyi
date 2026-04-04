import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DrugService } from './drug.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import {
  CreateDrugDto,
  UpdateDrugDto,
  UpdateDrugStatusDto,
  QueryDrugDto,
} from './dto';

@Controller('drugs')
export class DrugController {
  constructor(private readonly drugService: DrugService) {}

  /**
   * 创建药品（管理员）
   * POST /api/drugs
   */
  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createDrugDto: CreateDrugDto) {
    const drug = await this.drugService.create(createDrugDto);
    return {
      success: true,
      data: drug,
      message: '药品创建成功',
    };
  }

  /**
   * 获取药品列表（公开）
   * GET /api/drugs
   */
  @Get()
  async findAll(@Query() queryDto: QueryDrugDto) {
    const result = await this.drugService.findAll(queryDto);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * 获取药品统计数据（公开）
   * GET /api/drugs/statistics
   */
  @Get('statistics')
  async getStatistics() {
    const stats = await this.drugService.getStatistics();
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * 获取药品详情（公开）
   * GET /api/drugs/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const drug = await this.drugService.findOne(id);
    return {
      success: true,
      data: drug,
    };
  }

  /**
   * 更新药品信息（管理员）
   * PUT /api/drugs/:id
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async update(
    @Param('id') id: string,
    @Body() updateDrugDto: UpdateDrugDto,
  ) {
    const drug = await this.drugService.update(id, updateDrugDto);
    return {
      success: true,
      data: drug,
      message: '药品更新成功',
    };
  }

  /**
   * 更新药品状态（管理员）
   * PUT /api/drugs/:id/status
   */
  @Put(':id/status')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateDrugStatusDto,
  ) {
    const drug = await this.drugService.updateStatus(id, updateStatusDto);
    return {
      success: true,
      data: drug,
      message: '状态更新成功',
    };
  }

  /**
   * 删除药品（管理员，仅 pending 状态可删）
   * DELETE /api/drugs/:id
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.drugService.remove(id);
    return {
      success: true,
      message: '药品删除成功',
    };
  }

  /**
   * 获取药品历史收益率（公开）
   * GET /api/drugs/:id/history
   */
  @Get(':id/history')
  async getDrugHistory(@Param('id') id: string) {
    const history = await this.drugService.getDrugHistory(id);
    return {
      success: true,
      data: history,
    };
  }
}
