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
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
// sharp 是可选依赖，用于图片压缩；服务器缺少时不影响其他功能
let sharp: any = null;
try {
  sharp = require('sharp');
} catch (e) {
  console.warn('[DrugController] sharp 模块未安装，图片上传将跳过压缩优化');
}
import * as fs from 'fs';
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
   * 上传药品图片（管理员）
   * POST /api/drugs/upload-image
   */
  @Post('upload-image')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadDir = join(process.cwd(), 'public', 'uploads', 'drugs');
          cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `drug-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.mimetype)) {
          cb(new BadRequestException('仅支持 JPG/PNG/WebP 格式图片'), false);
          return;
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('请选择要上传的图片');
    }

    // 图片压缩处理
    try {
      const outputPath = file.path;
      const thumbPath = file.path.replace(/(\.[^.]+)$/, '_thumb$1');
      
      // 1. 主图压缩: 最大宽度 800px, 质量 80%
      await sharp(file.path)
        .resize({
          width: 800,
          height: 800,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80, progressive: true })
        .toFile(outputPath + '.tmp');
      
      // 替换原文件
      fs.renameSync(outputPath + '.tmp', outputPath);

      // 2. 移动端缩略图: 300px, 质量 75% (列表卡片 104px * 2x/3x retina)
      await sharp(outputPath)
        .resize({
          width: 300,
          height: 300,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 75, progressive: false })
        .toFile(thumbPath);
      
      console.log(`图片压缩完成: ${file.originalname}, 缩略图已生成`);
    } catch (error) {
      console.error('图片压缩失败:', error);
      // 压缩失败不影响上传,继续使用原图
    }

    const imageUrl = `/uploads/drugs/${file.filename}`;
    return {
      success: true,
      data: { url: imageUrl, filename: file.filename },
      message: '图片上传成功',
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
   * 删除药品（管理员，有关联订单时禁止删除）
   * DELETE /api/drugs/:id
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
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
