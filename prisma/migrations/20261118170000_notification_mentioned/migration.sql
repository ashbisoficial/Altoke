-- F1-1: notificación cuando alguien menciona a una persona en un comentario o descripción.
-- Aditiva: solo añade un valor al enum.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MENTIONED';
