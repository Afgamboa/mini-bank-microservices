import { NestFactory } from "@nestjs/core";
import { AppModule } from "./account.module";
import { ValidationPipe } from "@nestjs/common/pipes/validation.pipe";



async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.setGlobalPrefix('api');

    app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
    await app.listen(process.env.PORT || 3002);
}

bootstrap();