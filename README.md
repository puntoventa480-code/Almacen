<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Gestor Pro - Sistema de Gestión de Inventario y Deudas

Una aplicación completa para gestionar inventario, ventas, deudas y punto de venta con persistencia en la nube mediante Supabase.

## Características

- Gestión de productos e inventario
- Sistema de punto de venta (POS)
- Control de deudas y pagos
- Historial de movimientos de stock
- Asistente AI integrado
- Autenticación segura
- Sincronización en la nube con Supabase
- Generación e impresión de tickets

## Configuración

### Prerrequisitos

- Node.js (v18 o superior)
- Cuenta de Supabase (gratuita en supabase.com)
- Gemini API Key (opcional, para el asistente AI)

### Instalación

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Configurar variables de entorno:

   Edita el archivo `.env.local` con las siguientes variables:

   ```env
   GEMINI_API_KEY=tu-api-key-de-gemini
   VITE_SUPABASE_URL=tu-url-de-supabase
   VITE_SUPABASE_ANON_KEY=tu-anon-key-de-supabase
   ```

### Configuración de Supabase

La base de datos ya está configurada automáticamente. Las tablas y políticas de seguridad fueron creadas mediante migraciones.

Para obtener tus credenciales de Supabase:

1. Ve a [supabase.com](https://supabase.com)
2. Crea un nuevo proyecto (o usa uno existente)
3. Ve a Settings > API
4. Copia la `URL` y la `anon/public key`
5. Pégalas en tu archivo `.env.local`

### Ejecutar la aplicación

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

## Uso

1. Regístrate con tu email y contraseña
2. Una vez autenticado, podrás acceder a todas las funcionalidades
3. Los datos se sincronizan automáticamente con Supabase

## Funcionalidades principales

- **Dashboard**: Resumen de estadísticas y métricas clave
- **Inventario**: Gestión completa de productos
- **Punto de Venta**: Sistema de ventas rápido
- **Deudas**: Control de cuentas por cobrar
- **Asistente AI**: Ayuda inteligente para gestionar tu negocio
- **Configuración**: Personaliza la aplicación según tus necesidades
