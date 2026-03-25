# Panchería POS - Sistema de Punto de Venta

Sistema de punto de venta moderno construido con React, TypeScript y Firebase.

**Repositorio:** [juanzabczuk-rgb/https-github.com-pancheria-pos](https://github.com/juanzabczuk-rgb/https-github.com-pancheria-pos.git)

## Características

- Gestión de Inventario (Productos Simples y Compuestos)
- Ventas y Facturación
- Gestión de Clientes y Puntos
- Control de Caja y Turnos
- Gestión de Personal y Roles
- Estadísticas y Reportes

## Desarrollo Local

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Iniciar servidor de desarrollo:
   ```bash
   npm run dev
   ```

3. Ejecutar Linter:
   ```bash
   npm run lint
   ```

4. Formatear código:
   ```bash
   npm run format
   ```

## Seguridad y Reglas de Firebase

Las reglas de seguridad de Firestore están configuradas para restringir el acceso basado en roles (owner, admin, seller).

- **Owner/Admin**: Acceso total a todos los módulos.
- **Seller**: Acceso limitado a POS y Clientes.

## Variables de Entorno

Asegúrese de configurar las variables de entorno necesarias en su proyecto de Firebase.

## Firma de APK y Producción

Para generar una versión de producción para Android:

1. Genere un keystore:
   ```bash
   keytool -genkey -v -keystore release.keystore -alias apprelease -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Configure `android/app/build.gradle` con las credenciales del keystore.
3. Active ProGuard/R8 para ofuscación y reducción de tamaño.

---
Desarrollado para ser 100% gratuito utilizando el nivel gratuito de Firebase.
