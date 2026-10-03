-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: localhost    Database: ekut_db
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `menus`
--

DROP TABLE IF EXISTS `menus`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `menus` (
  `menu_id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `menu_name` varchar(100) NOT NULL,
  `description` text,
  `price` decimal(12,2) NOT NULL,
  `quantity` int NOT NULL DEFAULT '0',
  `photo` varchar(255) DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`menu_id`),
  KEY `fk_menu_tenant` (`tenant_id`),
  CONSTRAINT `fk_menu_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`tenant_id`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `menus`
--

LOCK TABLES `menus` WRITE;
/*!40000 ALTER TABLE `menus` DISABLE KEYS */;
INSERT INTO `menus` VALUES (1,1,'Ayam Geprek Original','Ayam geprek dengan sambal bawang',18000.00,20,NULL,'available','2026-10-01 18:02:23'),(2,1,'Ayam Geprek Keju','Ayam geprek dengan topping keju',22000.00,15,NULL,'available','2026-10-01 18:02:23'),(3,1,'Es Teh Manis','Es teh manis segar',5000.00,30,NULL,'available','2026-10-01 18:02:23'),(4,2,'Jus Alpukat','Jus alpukat segar',12000.00,20,NULL,'available','2026-10-01 18:02:23'),(5,2,'Jus Mangga','Jus mangga segar',12000.00,20,NULL,'available','2026-10-01 18:02:23'),(6,2,'Jus Jambu','Jus jambu merah segar',10000.00,15,NULL,'available','2026-10-01 18:02:23'),(7,3,'Chocolate Cake','Cake cokelat lembut',18000.00,10,NULL,'available','2026-10-01 18:02:23'),(8,3,'Cheesecake','Cheesecake creamy',20000.00,10,NULL,'available','2026-10-01 18:02:23'),(9,3,'Pudding','Pudding vanilla',10000.00,15,NULL,'available','2026-10-01 18:02:23'),(10,4,'Mie Ayam','Mie ayam dengan topping ayam',15000.00,20,NULL,'available','2026-10-01 18:02:23'),(11,4,'Bakso','Bakso kuah',15000.00,20,NULL,'available','2026-10-01 18:02:23'),(12,4,'Mie Ayam Bakso','Mie ayam dengan tambahan bakso',20000.00,15,NULL,'available','2026-10-01 18:02:23'),(13,5,'Pasta Carbonara','Pasta dengan saus carbonara',25000.00,15,NULL,'available','2026-10-01 18:02:23'),(14,5,'Spaghetti Bolognese','Spaghetti dengan saus bolognese',25000.00,15,NULL,'available','2026-10-01 18:02:23'),(15,5,'Coffee Latte','Kopi latte',18000.00,20,NULL,'available','2026-10-01 18:02:23'),(16,6,'Kue Lapis','Kue lapis tradisional',8000.00,20,NULL,'available','2026-10-01 18:02:23'),(17,6,'Klepon','Klepon gula merah',7000.00,25,NULL,'available','2026-10-01 18:02:23'),(18,6,'Risoles','Risoles isi sayuran',8000.00,20,NULL,'available','2026-10-01 18:02:23');
/*!40000 ALTER TABLE `menus` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-01 18:43:17
