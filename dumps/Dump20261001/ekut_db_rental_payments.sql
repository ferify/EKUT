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
-- Table structure for table `rental_payments`
--

DROP TABLE IF EXISTS `rental_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rental_payments` (
  `rental_id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `rental_period` varchar(20) NOT NULL,
  `due_date` date NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `payment_date` datetime DEFAULT NULL,
  `payment_proof` varchar(255) DEFAULT NULL,
  `status` varchar(30) NOT NULL,
  PRIMARY KEY (`rental_id`),
  KEY `fk_rental_tenant` (`tenant_id`),
  CONSTRAINT `fk_rental_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`tenant_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rental_payments`
--

LOCK TABLES `rental_payments` WRITE;
/*!40000 ALTER TABLE `rental_payments` DISABLE KEYS */;
INSERT INTO `rental_payments` VALUES (1,1,'2026-10','2026-10-05',500000.00,'2026-10-03 10:00:00','proof_tenant_1.jpg','paid'),(2,2,'2026-10','2026-10-05',500000.00,'2026-10-04 11:00:00','proof_tenant_2.jpg','paid'),(3,3,'2026-10','2026-10-05',500000.00,NULL,NULL,'pending'),(4,4,'2026-10','2026-10-05',500000.00,'2026-10-02 09:00:00','proof_tenant_4.jpg','paid'),(5,5,'2026-10','2026-10-05',500000.00,NULL,NULL,'overdue'),(6,6,'2026-10','2026-10-05',500000.00,'2026-10-04 14:00:00','proof_tenant_6.jpg','paid');
/*!40000 ALTER TABLE `rental_payments` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-01 18:43:19
