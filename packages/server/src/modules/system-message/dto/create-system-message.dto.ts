export class CreateSystemMessageDto {
  title: string
  content: string
  type?: string  // announcement | notification | maintenance
}
