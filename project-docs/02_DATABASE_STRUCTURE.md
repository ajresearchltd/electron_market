1.TABLE: Products

Product_ID
Product_Type
Product_Name
Category
Subcatego2ry
Brand_Manufacturer
Model_Series
Part_Number_MPN
SKU_Internal
GTIN_EAN
Country_Of_Origin
Short_Description
Full_Description
Supplier_Type
Business_Type
Number_Of_Suppliers
Number_Of_Manufacturers
Verified_Suppliers
Official_Authorized_Distributor
Availability
Stock_Location
MOQ_Quantity
MOQ_Unit
Price_Type
Base_Price
Base_Currency
Min_Price
Max_Price
Price_Range_Currency
Price_On_Request
Lead_Time
Delivery_Time_Estimated
Shipping_Methods
Delivery_Countries
Packaging_Details
HS_Code
Installation_Available
Training_Available
Maintenance_Available
Technical_Support
Spare_Parts_Available
Customization_Available
Service_Description
Meta_Title
Meta_Description
Visibility
Warranty
Return_Policy
Condition
Notes
Product_Status
Main_Image_URL
Created_Date
Updated_Date
Supplier_ID
Manufacturer_ID
Created_By_User_ID


2.TABLE: ProductSpecifications

Specification_ID
Product_ID
Specification_Name
Specification_Value
Unit


3.TABLE: ProductImages

Image_ID
Product_ID
Image_URL
Image_Title
Is_Main_Image
Sort_Order


4.TABLE: ProductDocuments

Document_ID
Product_ID
Document_Type
Document_Name
File_URL


5.TABLE: ProductShippingMethods

Shipping_Method_ID
Product_ID
Shipping_Method


6.TABLE: ProductDeliveryCountries

Country_ID
Product_ID
Country_Name


7.TABLE: AlternativeProducts

Alternative_ID
Product_ID
Alternative_Part_Number
Alternative_Product_Name
Alternative_Manufacturer_Brand


8.TABLE: ProductServices

Service_ID
Product_ID
Installation_Available
Training_Available
Maintenance_Available
Technical_Support
Spare_Parts_Available
Customization_Available
Service_Description


9.TABLE: Suppliers

Supplier_ID
Supplier_Name
Supplier_Type
Business_Type
Country
City
Address
Website
Email
Phone
Contact_Person
Verified_Supplier
Official_Authorized_Distributor
Supplier_Status
Company_Description
Logo_URL
Created_Date
Updated_Date


10.TABLE: Manufacturers

Manufacturer_ID
Manufacturer_Name
Country
Website
Email
Phone
Company_Description
Logo_URL
Manufacturer_Status
Created_Date
Updated_Date


11.TABLE: RFQ

RFQ_ID
RFQ_Name
RFQ_Type
RFQ_Visibility
Project_Description
Required_Delivery_Date
Incoterms_Preference
Destination_Country
Target_Budget
Official_Suppliers_Only
Manufacturers_Only
Include_Substitute_Alternate_Parts
Need_Technical_Support
RFQ_Status
Created_By_User_ID
Created_Date
Updated_Date


12.TABLE: RFQ_Items

RFQ_Item_ID
RFQ_ID
Rec_Num
Part_Num
Name_Of_Detail
Specification
Amount
Additional_Info


13.TABLE: RFQ_BOM_Files

BOM_File_ID
RFQ_ID
BOM_File_URL
BOM_File_Name
BOM_File_Type
BOM_File_Size
Uploaded_Date
AI_Analysis_Status
AI_Matched_Suppliers_Count


14.TABLE: RFQ_Target_Suppliers

RFQ_Target_Supplier_ID
RFQ_ID
Supplier_ID
Send_Status
Sent_Date
Viewed_Date
Quote_Status


15.TABLE: RFQ_Quotes

Quote_ID
RFQ_ID
RFQ_Target_Supplier_ID
Supplier_ID
Quote_Status
Total_Amount
Currency
Delivery_Time
Incoterms
Supplier_Comment
Created_Date


16.TABLE: RFQ_Quote_Items

Quote_Item_ID
Quote_ID
RFQ_Item_ID
Offered_Part_Num
Offered_Name_Of_Detail
Offered_Specification
Offered_Amount
Unit_Price
Total_Price
Currency
Is_Substitute_Alternate
Delivery_Time
Comment


17. TABLE: RFQ_Messages

Message_ID
RFQ_ID
Supplier_ID
Sender_User_ID
Receiver_User_ID
Message_Subject
Message_Text
Message_Status
Sent_Date
Read_Date


18.TABLE: Pages

Page_ID
Page_Name
Page_Title
Page_URL
Page_Type
Meta_Title
Meta_Description
Sort_Order
Is_Active



19. TABLE:Homepage_Content
1_contry 
1_language
1_name
1_ description 
1_Title_of_site
1_Subtitle_of_site
1_Link_to_getBOM
1_Link_to_Supplier
1_underTitle1
1_underTitle2
1_underTitle3
1_underTitle4
1_Menu1
1_Menu1_link
1_Menu2
1_Menu2_link
1_Menu3
1_Menu3_link
1_Menu4
1_Menu4_link
2_title1  
2_title2
2_pic1
2_name1
2_text1
2_pic2
2_name2
2_text2
2_pic3
2_name3
2_text3
2_pic4
2_name4
2_text4
2_link_button 

3_title
3_description
4_title
4_description
5_title
5_description
5_name1
5_text1
5_pic1
5_name2
5_text2
5_pic2
5_name3
5_text3
5_pic3
5_name4
5_text4
5_pic4
5_name5
5_text5
5_pic5
5_name6
5_text6
5_pic6
6_title
6_description
6_title1
6_text1
6_pic1
6_title2
6_text2
6_pic2
6_title3
6_text3
6_pic3
6_title4
6_text4
6_pic4
6_simple1
6_simple2
6_simple3
6_simple4
7_title
7_description
7_title1
7_text1
7_pic1
7_title2
7_text2
7_pic2
7_title3
7_text3
7_pic3
7_title4
7_text4
7_pic4
7_title5
7_text5
7_pic5
8 _title
8_description
8_title1
8_text1
8_pic1
8_title2
8_text2
8_pic2
8_title3
8_text3
8_pic3
8_title4
8_text4
8_pic4
8_title5
8_text5
8_pic5
8_title6
8_text6
8_pic6
9_titel
9_description
10_title
10_description
11_Title
11_Description
11_pic1
11_digit1
11_text1
11_pic2
11_digit2
11_text2
11_pic3
11_digit3
11_text3
11_pic4
11_digit4
11_text4
11_pic5
11_digit5
11_text5
11_pic6
11_digit6
11_text6

12_title 
12_deviz
12_logo
12_pic_card1
12_pic_card1_link
12_pic_card2
12_pic_card2_link
12_pic_card3
12_pic_card3_link
12_pic_card4
12_pic_card4_link
12_pic_card5
12_pic_card5_link
12_pic_card6
12_pic_card6_link
12_how_it_work
12_how_it_work_link
12_submit_RFQ
12_submit_RFQ_link
12_Find_supplier
12_Find_supplier_link
12_Help_center
12_Help_center_link
12_Join_as_supplier
12_Join_as_supplier_link
12_Supplier_guide
12_Supplier_guide_link
12_Benefit
12_Benefit_link
12_Resources
12_Resources_link
12_About_us
12_About_us_link
12_News
12_News_link
12_careers
12_careers_link
12_Partners
12_Partners_link
12_Contact_us
12_Contact_us_link



20.TABLE: Category 
Cat_ID
Pic 
Name
Text
Description 
Type_of_product

21-3.TABLE:Verified_supplier
	Supplier_ID
	Name
	Pic 
	Delivery_product 
 
22-9. TABLE: Industry_solution 
	Ind_ID
Title
	Text
	Pic

23-10. TABLE: Customer_say
	Ref_ID
Title
Text
Pic
24. TABLE: Type_product
	Type_ID
Title
Text
Pic
Description 
