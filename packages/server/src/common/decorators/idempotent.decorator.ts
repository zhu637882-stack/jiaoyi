import { SetMetadata } from '@nestjs/common'

export const IDEMPOTENT_KEY = 'isIdempotent'

export const Idempotent = () => SetMetadata(IDEMPOTENT_KEY, true)
