<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Session;

use App\Models\Stock;
use App\Models\Test;
/************************************
*  
*  TradingView Bot
*  
*************************************/

class TgBotController extends SiteController {
   
    // 首頁
    public function index(Request $request) {
    	
        $this->getRequest($request);
        $reponse = $this->request;
        $this->record($reponse);

        date_default_timezone_set("Asia/Taipei");

        $reponse['ticker']  = str_replace([".P"], [""], $reponse['ticker']);

        $mode = "";
        switch ($reponse['mode']) {
            case "PD":
                    $sense = "做多";
                    break;
            case "ND":
                    $sense = "做空";
                    break;
            case "LONG":
                    $sense = "做多";
                    break;
            case "SHORT":
                    $sense = "做空";
                    break;
        }
    
        $this->send($reponse, $sense);
        
        
    }


    // send message
    protected function send($reponse, $sense) {

        if ($reponse['ticker'] == "VIX") {

            $message = "
！！ VIX ！！
=========================
警報類型 : VIX
操作方向 : " . $sense . "
當前價格 : " . $reponse['close'] . "
發送時間 : " . date("Y-m-d H:i:s") . "
";
        } else {
            
        $message = $reponse['ticker'] . " " . $reponse['type'] . " 
=========================
警報類型 : " . $reponse['kind'] . "
操作方向 : " . $sense . "
當前價格 : " . $reponse['close'] . "
發送時間 : " . date("Y-m-d H:i:s") . "

Binance : https://www.binance.com/zh-TC/futures/" . $reponse['ticker'] . "
";
        
        }

        // 我自已 測試用
        file_get_contents("https://api.telegram.org/bot7360641960:AAHeOdSE1MmR5nJU1iiJtP0pM0-W9XEgTOU/sendMessage?chat_id=545205414&text=" . urlencode($message));
        
        // 群
        // file_get_contents("https://api.telegram.org/bot7360641960:AAHeOdSE1MmR5nJU1iiJtP0pM0-W9XEgTOU/sendMessage?chat_id=-4264595778&text=" . urlencode($message));


    }

    // request 紀錄
    protected function record($reponse) {
        Test::create([
            "data" => json_encode($reponse)
        ]);
    } 

    /////////////////////////////////////////
}
